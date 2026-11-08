import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/journey',testMatch:'dialogue-click.spec.ts',timeout:90000,workers:1,reporter:'list',use:{baseURL:process.env.LIVE_URL??'http://127.0.0.1:4184/',viewport:{width:640,height:400}},projects:[{name:'chrome',use:{browserName:'chromium',channel:'chrome'}},{name:'webkit',use:{browserName:'webkit'}}]});
