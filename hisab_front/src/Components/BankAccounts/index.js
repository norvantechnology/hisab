export { default as AccountCard } from './AccountCard';
export { default as AccountModal } from './AccountModal';
export { default as AccountDetailsOffcanvas } from './AccountDetailsOffcanvas';
export { default as EmptyState } from './EmptyState';
export { FormField, SelectField } from './FormFields';
import { 
    RiCashLine,
    RiBankCardLine,
    RiWallet3Line,
    RiBankLine,
} from 'react-icons/ri';

export const ACCOUNT_TYPES = {
    cash: { label: 'Cash', icon: <RiCashLine />, color: 'success' },
    bank: { label: 'Bank', icon: <RiBankLine />, color: 'primary' },
    credit_card: { label: 'Credit Card', icon: <RiBankCardLine />, color: 'danger' },
    wallet: { label: 'Wallet', icon: <RiWallet3Line />, color: 'warning' }
};