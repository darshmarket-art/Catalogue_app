import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Store } from '../store';
import type { MerchantConfig } from '../merchant';
import type { SectorPack } from '../sectors';
import { user } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import { cartItemSchema } from '../schemas';
import { recordDaily } from '../stats';
import type { Media } from '../media';
import { enabledKeys, loadPurities } from '../purities';
import type { Notify } from '../notify';
import { bumpVisitor, logActivity } from '../visitors';

type CartItem = Record<string, any>;

const publicItem = ({ ownerId: _owner, createdAt: _created, ...item }: CartItem) => item;
const sumNet = (items: CartItem[]) => items.reduce((sum, i) => sum + (i.totalNetGold || 0), 0);

export function orderRoutes(store: Store, merchant: MerchantConfig, pack: SectorPack, media: Media, requireRetailer: RequestHandler, notify: Notify) {
  const router = Router();
  router.use(requireRetailer);
  const shown = (item: CartItem) => media.presentItem(publicItem(item));

  const loadCart = async (ownerId: string) =>
    (await store.list<CartItem>('cartItems', { where: [{ field: 'ownerId', op: '==', value: ownerId }] })).sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt))
    );

  router.get(
    '/',
    handler(async (_req, res) => {
      const items = await loadCart(user(res).id);
      res.json({
        status: 'success',
        count: items.length,
        totalWeightNetGrams: parseFloat(sumNet(items).toFixed(3)),
        totalItems: items.length,
        totalPieces: items.reduce((sum, i) => sum + (i.batchQty || 1), 0),
        settlementBasis: 'GRAM_WEIGHT',
        data: items.map(shown)
      });
    })
  );

  // The buyer's own past orders, newest first.
  router.get(
    '/history',
    handler(async (_req, res) => {
      const mine = await store.list('purchaseOrders', { where: [{ field: 'retailerId', op: '==', value: user(res).id }] });
      const data = mine
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .slice(0, 100)
        .map(({ buyer: _buyer, retailerId: _retailer, ...order }) => ({
          ...order,
          status: order.status ?? 'new',
          items: (order.items ?? []).map((i: CartItem) => media.presentItem(i))
        }));
      res.json({ status: 'success', count: data.length, data });
    })
  );

  // A buyer may cancel their own order until the owner has confirmed it. After that, they need to speak to the owner.
  router.post(
    '/:poId/cancel',
    handler(async (req, res) => {
      const order = await store.get('purchaseOrders', req.params.poId);
      if (!order || order.retailerId !== user(res).id) throw new HttpError(404, 'Order not found.');
      const status = order.status ?? 'new';
      if (status === 'cancelled') return res.json({ status: 'success', data: { poId: order.poId, status } });
      if (status !== 'new') {
        throw new HttpError(409, `This order is already ${status}. Please call ${merchant.brand.name} on ${merchant.contact.deskPhone} to change it.`);
      }
      await store.update('purchaseOrders', order.poId, { status: 'cancelled', statusUpdatedAt: new Date().toISOString(), cancelledBy: 'buyer' });
      await audit(store, req, 'ORDER_CANCELLED_BY_BUYER', `PO ${order.poId} cancelled by ${user(res).name}.`);
      void notify('cancelled', order);
      res.json({ status: 'success', data: { poId: order.poId, status: 'cancelled' } });
    })
  );

  // Weights, purity and imagery come from the catalogue, never from the client.
  router.post(
    '/items',
    handler(async (req, res) => {
      const body = parse(cartItemSchema, req.body);
      const [product] = await store.list('products', { where: [{ field: 'sku', op: '==', value: body.sku }], limit: 1 });
      if (!product) throw new HttpError(404, `No catalogue item found for SKU ${body.sku}.`);

      const id = newId('ord');
      const line = pack.cartLine(product, body.batchQty);
      // A purity the buyer asks for is used only if the owner offers it; anything else falls back to the design's own.
      const purity = body.purity && enabledKeys(await loadPurities(store)).includes(body.purity) ? body.purity : line.purity;
      const item: CartItem = {
        id,
        ownerId: user(res).id,
        title: product.title,
        sku: product.sku,
        purity,
        totalNetGold: line.totalNetGold,
        batchQty: body.batchQty,
        qtyUnit: body.qtyUnit || (body.batchQty > 1 ? 'Pcs' : 'Set'),
        unitWt: line.unitWt,
        unitDescription: line.unitDescription,
        note: body.note || line.note,
        image: product.image,
        createdAt: new Date().toISOString()
      };
      await store.set('cartItems', id, item);
      const me = user(res);
      const actor = { id: me.id, kind: 'verified' as const, name: me.name };
      await Promise.all([logActivity(store, actor, { type: 'cart', sku: product.sku }), bumpVisitor(store, actor, { addedToCart: 1 })]);
      res.status(201).json({ status: 'success', message: 'Added to batch order', data: shown(item) });
    })
  );

  router.delete(
    '/items/:id',
    handler(async (req, res) => {
      const item = await store.get<CartItem>('cartItems', req.params.id);
      if (!item || item.ownerId !== user(res).id) throw new HttpError(404, 'Item not found in order');
      await store.delete('cartItems', item.id);
      res.json({ status: 'success', message: 'Item removed', data: shown(item) });
    })
  );

  router.post(
    '/confirm',
    handler(async (_req, res) => {
      const owner = user(res);
      const items = await loadCart(owner.id);
      if (items.length === 0) throw new HttpError(400, 'Your batch order is empty. Add items before confirming.');

      const totalNet = parseFloat(sumNet(items).toFixed(3));
      const poId = `${merchant.orders.poPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;
      const bookedAt = new Date().toISOString();

      // Snapshot of who ordered, so the merchant can contact them even if the account changes later.
      const buyer = await store.get('buyers', owner.id);

      await store.set('purchaseOrders', poId, {
        poId,
        status: 'new',
        retailerId: owner.id,
        firmName: owner.name,
        buyer: buyer
          ? { firmName: buyer.firmName, ownerName: buyer.ownerName, phone: buyer.phone, gstin: buyer.gstin, marketHub: buyer.marketHub }
          : null,
        totalNetGrams: totalNet,
        itemCount: items.length,
        items: items.map(publicItem),
        timestamp: bookedAt
      });
      // The batch is now an order; the next batch starts empty instead of re-ordering these items.
      await Promise.all(items.map((i) => store.delete('cartItems', i.id)));
      await recordDaily(store, { booked: 1, bookedGrams: totalNet });
      await audit(store, null, 'WHOLESALE_BATCH_BOOKED_GRAM_BASIS', `PO ${poId} booked by ${owner.name} on Gram Basis: ${totalNet.toFixed(3)}g fine gold across ${items.length} items.`);

      void notify('placed', { poId, firmName: owner.name, totalNetGrams: totalNet, itemCount: items.length });
      res.json({
        status: 'success',
        poId,
        bookedTimestamp: bookedAt,
        settlementBasis: 'GRAM_WEIGHT',
        totalNetGrams: totalNet,
        itemCount: items.length,
        whatsappMessage: pack.confirmationMessage({
          brandName: merchant.brand.name,
          poId,
          firmName: owner.name,
          totalNet,
          items: items.map((i) => ({ title: i.title, sku: i.sku, purity: i.purity, batchQty: i.batchQty, qtyUnit: i.qtyUnit, totalNetGold: i.totalNetGold }))
        })
      });
    })
  );

  return router;
}
