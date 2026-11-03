import { DEFAULT_LAYOUT, type LayoutId } from '../../shared/layouts';

/** Which layout a session gets: the store's pick for buyers and owners alike (the owner previews and works in the same look), Classic when the Maison chunk could not load. */
export const layoutFor = (storeLayout: string | undefined, maisonFailed = false): LayoutId => (storeLayout === 'maison' && !maisonFailed ? 'maison' : DEFAULT_LAYOUT);
