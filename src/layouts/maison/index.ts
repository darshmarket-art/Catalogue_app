import type { LayoutKit } from '../props';
import './maison.css';
import './owner/content.css';
import { Header } from './Header';
import { Welcome } from './Welcome';
import { Home } from './Home';
import { About } from './About';
import { Catalogue } from './Catalogue';
import { Shortlist } from './Shortlist';
import { Orders } from './Orders';

// Maison: black and white, thin display serif, square and full-bleed. Every screen has its own markup; the Catalogue and the design page share
// their state and server calls with Emergent through useCatalogue and useProductDetail. The masthead carries the navigation, so there is no tab bar.
export const maison: LayoutKit = { Header, BottomNav: () => null, Welcome, Categories: Home, Catalogue, Shortlist, Orders, About };
