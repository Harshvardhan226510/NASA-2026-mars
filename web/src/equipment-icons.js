// Decorative line icons; names and status text remain the accessible labels.
const paths={
 sites:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
 catalog:'<path d="m5 19 7-7m-3-7 4 4 5-5 2 2-5 5 4 4-3 3-4-4-7 7-3-3 7-7"/>',
 base:'<path d="M4 4v16h16M8 16v-4m4 4V8m4 8v-6"/>',
 solar_array:'<path d="M3 5h18l-2 10H5L3 5Zm9 0v15m-5 0h10M4 10h16M8 5l1 10m7-10-1 10"/>',
 comms_mast:'<path d="M12 11v10m-4 0h8M5 4a7 7 0 0 0 10 10L5 4Zm8 0a7 7 0 0 1 7 7m-7-3a3 3 0 0 1 3 3"/>',
 seis_station:'<path d="M3 18h18M5 18v-3a7 7 0 0 1 14 0v3M4 11h4l2-5 3 9 2-4h5"/>',
 weather_station:'<path d="M12 4v17m-5 0h10M5 7h14M8 4v6m8-6v6M4 14h5m6 0h5"/><circle cx="12" cy="3" r="1"/>',
 crew_hab:'<path d="M3 20V9l9-6 9 6v11H3Zm6 0v-7h6v7M7 9h2m6 0h2"/>',
 greenhouse_dome:'<path d="M2 20h20M3 20v-3a9 9 0 0 1 18 0v3M12 8v12m0-5c-4 0-5-2-5-4 3 0 5 1 5 4Zm0 2c4 0 5-2 5-4-3 0-5 1-5 4Z"/>',
 nuclear_reactor:'<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
 isru_plant:'<path d="M9 3h6m-5 0v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10"/>',
 crew_rover:'<path d="M3 16V9h10l4 4h4v3H3Zm3-7V5h7v4"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
 power:'<path d="m13 2-8 12h6l-1 8 9-12h-6l1-8Z"/>',
 dust:'<path d="M3 8h13a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M5 18h5"/>'
};
export function equipmentIcon(kind){return `<svg class="equipment-line-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[kind]??paths.base}</svg>`;}
