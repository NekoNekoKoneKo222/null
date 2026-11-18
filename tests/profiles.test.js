import test from 'node:test';
import assert from 'node:assert/strict';
import {makeFallbackProfiles,normalizeProfiles,hashString,mulberry32} from '../shared/profiles.js';
const people=[{id:'p0',name:'青木',job:'学生',age:21},{id:'p1',name:'田中',job:'店員',age:38}];
test('population generation stable for seed',()=>{assert.deepEqual(makeFallbackProfiles(people,123),makeFallbackProfiles(people,123));assert.notDeepEqual(makeFallbackProfiles(people,123),makeFallbackProfiles(people,124));});
test('normalizes untrusted AI results',()=>{const profiles=normalizeProfiles(people,[{id:'p0',sociability:12,curiosity:-1,description:'友好的'}],12);assert.equal(profiles[0].sociability,1);assert.equal(profiles[0].curiosity,0);assert.equal(profiles.length,2);});
test('hash generator deterministic',()=>{assert.equal(hashString('abc'),hashString('abc'));assert.equal(mulberry32(88)(),mulberry32(88)());});
