import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/visual',timeout:30000,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:5178/',viewport:{width:1280,height:800}},projects:[{name:'chromium',use:{browserName:'chromium'}}]});
