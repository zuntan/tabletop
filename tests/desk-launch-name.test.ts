import test from 'node:test';
import assert from 'node:assert/strict';
import { nextAutomaticDeskName, localizedLaunchName } from '../src/desk-launch-name';

test('automatic launch names avoid both Japanese and English untitled families',()=>{
 assert.equal(nextAutomaticDeskName([]),'Untitled');
 assert.equal(nextAutomaticDeskName(['','Untitled(2)','無題(3)','Planning']),'Untitled(4)');
 assert.equal(nextAutomaticDeskName(['無題','Untitled(3)']),'Untitled(2)');
 assert.equal(nextAutomaticDeskName(['My Untitled','無題(0)']),'Untitled');
});

test('only explicitly automatic launch names are localized; custom names remain literal',()=>{
 assert.equal(localizedLaunchName('Untitled(2)',true,'無題'),'無題(2)');
 assert.equal(localizedLaunchName('無題(3)',true,'Untitled'),'Untitled(3)');
 assert.equal(localizedLaunchName('Untitled',true,'無題'),'無題');
 for(const name of ['Untitled(2)','無題','Planning','無題(0)','Untitled(99999999999999999999999)']){
  assert.equal(localizedLaunchName(name,false,'Other'),name);
 }
 assert.equal(localizedLaunchName('Planning',true,'無題'),'Planning');
});
