import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Store } from '../store';
import type { MerchantConfig } from '../merchant';
import type { SectorPack } from '../sectors';
import { user } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import { cartItemSchema } from '../schemas';
import { recordDaily } from '../stats';

type CartItem = Record<string, any>;

const publicItem = ({ ownerId: _owner, createdAt: _created, ...item }: CartItem) => item;
const sumNet = (items: CartItem[]) => items.reduce((sum, i) => sum + (i.totalNetGold || 0), 0);

export function orderRoutes(store: Store, merchant: MerchantConfig, pack: SectorPack, requireRetailer: RequestHandler) {
  const router = Router();
  router.use(requireRetailer);

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
        data: items.map(publicItem)
      });
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
      const item: CartItem = {
        id,
        ownerId: user(res).id,
        title: product.title,
        sku: product.sku,
        purity: line.purity,
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
      res.status(201).json({ status: 'success', message: 'Added to batch order', data: publicItem(item) });
    })
  );

  router.delete(
    '/items/:id',
    handler(async (req, res) => {
      const item = await store.get<CartItem>('cartItems', req.params.id);
      if (!item || item.ownerId !== user(res).id) throw new HttpError(404, 'Item not found in order');
      await store.delete('cartItems', item.id);
      res.json({ status: 'success', message: 'Item removed', data: publicItem(item) });
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
      await recordDaily(store, { booked: 1, bookedGrams: totalNet });
      await audit(store, null, 'WHOLESALE_BATCH_BOOKED_GRAM_BASIS', `PO ${poId} booked by ${owner.name} on Gram Basis: ${totalNet.toFixed(3)}g fine gold across ${items.length} items.`);

      res.json({
        status: 'success',
        poId,
        bookedTimestamp: bookedAt,
        settlementBasis: 'GRAM_WEIGHT',
        totalNetGrams: totalNet,
        itemCount: items.length,
        whatsappMessage: pack.confirmationMessage({ brandName: merchant.brand.name, poId, totalNet, itemCount: items.length })
      });
    })
  );

  return router;
}
