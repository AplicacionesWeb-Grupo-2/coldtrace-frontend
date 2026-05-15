import './assets/main.css';

import { createApp } from 'vue';
import App from './App.vue';
import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import Material from '@primeuix/themes/material';
import PrimeVue from 'primevue/config';
import i18n from '@/i18n.js';
import {
    Button,
    Card,
    Checkbox,
    Column,
    ConfirmationService,
    ConfirmDialog,
    DataTable,
    Dialog,
    DialogService,
    Drawer,
    FloatLabel,
    IconField,
    InputIcon,
    InputText,
    Password,
    Select,
    Tag,
    Toast,
    ToastService,
    Toolbar,
    Tooltip,
} from 'primevue';
import pinia from '@/pinia.js';
import router from '@/router.js';

createApp(App)
    .use(i18n)
    .use(PrimeVue, { theme: { preset: Material }, ripple: true })
    .use(ConfirmationService)
    .use(DialogService)
    .use(ToastService)
    .component('pv-button', Button)
    .component('pv-card', Card)
    .component('pv-checkbox', Checkbox)
    .component('pv-column', Column)
    .component('pv-confirm-dialog', ConfirmDialog)
    .component('pv-data-table', DataTable)
    .component('pv-dialog', Dialog)
    .component('pv-drawer', Drawer)
    .component('pv-float-label', FloatLabel)
    .component('pv-icon-field', IconField)
    .component('pv-input-icon', InputIcon)
    .component('pv-input-text', InputText)
    .component('pv-password', Password)
    .component('pv-select', Select)
    .component('pv-tag', Tag)
    .component('pv-toast', Toast)
    .component('pv-toolbar', Toolbar)
    .component('tooltip', Tooltip)
    .use(router)
    .use(pinia)
    .mount('#app');
