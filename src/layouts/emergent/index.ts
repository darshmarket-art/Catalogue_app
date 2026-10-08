import type { LayoutKit } from '../props';
import './emergent.css';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Welcome } from './Welcome';
import { Home } from './Home';
import { Catalogue } from './Catalogue';
import { Shortlist } from './Shortlist';
import { Orders } from './Orders';
import { About } from './About';

// Emergent (boutique, Pro): the same screens and props as Gilded, laid out like the Emergent Screen Atlas. Home is the 'Categories' slot.
export const emergent: LayoutKit = { Header, BottomNav, Welcome, Categories: Home, Catalogue, Shortlist, Orders, About };
