import type { LayoutKit } from '../props';
import './maison.css';
import './owner/content.css';
import { Header as BuyerHeader } from './Header';
import { OwnerHeader, OwnerNav } from './owner/Shell';
import { Welcome } from './Welcome';
import { Home } from './Home';
import { About } from './About';
import { Catalogue } from './Catalogue';
import { Shortlist } from './Shortlist';
import { Orders } from './Orders';

// Maison: black and white, thin display serif, square and full-bleed. Every screen has its own markup; the Catalogue and the design page share
// their state and server calls with Emergent through useCatalogue and useProductDetail. The buyer's masthead carries the navigation, so buyers have
// no tab bar; the owner gets a sidebar (desktop) or a bottom bar of four words (phones), see ./owner.
export const maison: LayoutKit = {
  Header: (p) => (p.isAdminLoggedIn ? <OwnerHeader {...p} /> : <BuyerHeader {...p} />),
  BottomNav: (p) => (p.isAdminLoggedIn ? <OwnerNav {...p} /> : null),
  Welcome, Categories: Home, Catalogue, Shortlist, Orders, About
};
