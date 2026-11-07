import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/journey',timeout:30000,workers:1,reporter:'list',use:{baseURL:process.env.LIVE_URL??'http://127.0.0.1:5175/',viewport:{width:1280,height:720}},projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}},{name:'firefox',use:{browserName:'firefox'}}]});
