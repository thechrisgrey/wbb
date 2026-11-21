// Shared styles first, then the app. Sections and UI modules import their own CSS from entry.js,
// which guarantees those rules land after base.css and win ties.
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './entry.js';
