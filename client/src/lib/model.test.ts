import { describe, it, expect } from 'vitest';
import { writablePayload } from './model';
import type {ResourceSchema} from './types';
const schema: ResourceSchema = {label:'Policies', singular:'policy', statuses:['draft','published'], fields:[{key:'title',label:'Title',type:'text',required:true},{key:'review_date',label:'Review date',type:'date'},{key:'control_ids',label:'Controls',type:'multiselect'},{key:'version',label:'Version',type:'number',readonly:true}]};
describe('schema-backed writes', () => {
 it('only sends writable schema fields and converts empty dates to null', () => {
   expect(writablePayload(schema, {id:'p1',title:'Security',review_date:'',control_ids:['c1'],version:5,created_at:'today',surprise:true})).toEqual({title:'Security',review_date:null,control_ids:['c1']});
 });
});
