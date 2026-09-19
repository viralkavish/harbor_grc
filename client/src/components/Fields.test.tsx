import {it,expect,vi} from 'vitest';
import {useState} from 'react';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Fields} from './Fields';
import {api} from '../lib/api';
import type {ResourceSchema} from '../lib/types';
it('edits linked records using human names and preserves their server IDs', async () => {
 vi.spyOn(api,'get').mockResolvedValue({items:[{id:'f1',title:'SOC 2',code:'SOC2'},{id:'f2',title:'ISO 27001',code:'ISO'}],total:2});
 const changes=vi.fn();
 const schema:ResourceSchema={label:'Controls',singular:'control',statuses:['not_started'],fields:[{key:'title',label:'Title',type:'text',required:true},{key:'framework_ids',label:'Frameworks',type:'multiselect'}]};
 function Harness(){const [value,setValue]=useState<Record<string,any>>({title:''});return <Fields schema={schema} value={value} onChange={(k,v)=>{changes(k,v);setValue(x=>({...x,[k]:v}));}}/>}
 render(<Harness/>);
 await userEvent.type(screen.getByLabelText(/Title/),'Access reviews');
 await userEvent.click(await screen.findByRole('checkbox',{name:/SOC 2/}));
 expect(changes).toHaveBeenLastCalledWith('framework_ids',['f1']);
 expect(screen.getByRole('checkbox',{name:/SOC 2/})).toBeChecked();
});
