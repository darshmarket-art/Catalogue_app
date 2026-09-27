import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Store } from '../store';
import { user } from '../auth';
import { HttpError, audit, handler, newId, parse } from '../http';
import { cartItemSchema } from '../schemas';
import { recordDaily } from '../stats';

type CartItem = Record<string, any>;

const publicItem = ({ ownerId: _owner, createdAt: _created, ...item }: CartItem) => item;
const sumNet = (items: CartItem[]) => items.reduce((sum, i) => sum + (i.totalNetGold || 0), 0);

export function orderRoutes(store: Store, requireRetailer: RequestHandler) {
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
      const item: CartItem = {
        id,
        ownerId: user(res).id,
        title: product.title,
        sku: product.sku,
        purity: product.purity,
        totalNetGold: parseFloat((product.netWt * body.batchQty).toFixed(3)),
        batchQty: body.batchQty,
        qtyUnit: body.qtyUnit || (body.batchQty > 1 ? 'Pcs' : 'Set'),
        unitWt: product.netWt,
        unitDescription: `${product.netWt} g / pc`,
        note: body.note || `BIS Hallmarked • HUID: ${product.huid}`,
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
      const poId = `PO-BHAKTI-${Math.floor(100000 + Math.random() * 900000)}`;
      const bookedAt = new Date().toISOString();

      await store.set('purchaseOrders', poId, {
        poId,
        retailerId: owner.id,
        firmName: owner.name,
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
        escrowGuaranteeRef: 'GUJ-BUL-ESCROW-2026-9921',
        whatsappMessage: `*BHAKTI JEWELS B2B WHOLESALE CONFIRMATION (GRAM BASIS)*\n*PO:* ${poId}\n*Total Fine Gold Weight:* ${totalNet.toFixed(3)}g Net\n*Items in Batch:* ${items.length}\n*Settlement Terms:* Pure Fine Gold Gram Settlement (999.9 Bullion Bar Handover or Gold Metal Loan Credit)\n*Dispatch Vault:* Sequel / BVC Armoured Logistics\nKindly confirm dispatch slot.`
      });
    })
  );

  return router;
}
