import type { LayoutKit } from '../props';
import { Catalogue } from '../emergent/Catalogue';
import { Shortlist } from '../emergent/Shortlist';
import { Orders } from '../emergent/Orders';
import './maison.css';
import { Header } from './Header';
import { Welcome } from './Welcome';
import { Home } from './Home';
import { About } from './About';

// Maison: black and white, thin display serif, square and full-bleed. Header, Welcome, Home and About are its own markup; the catalogue,
// design page, shortlist and orders reuse Emergent's screens (all the filter, cart and order logic) and are restyled by maison.css.
// The masthead carries the navigation, so there is no tab bar.
export const maison: LayoutKit = { Header, BottomNav: () => null, Welcome, Categories: Home, Catalogue, Shortlist, Orders, About };
