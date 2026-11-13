// Family Finance - Supabase connection settings
const SUPABASE_URL = 'https://ludrupofaaeqmqzvhvox.supabase.co';
// IMPORTANT: paste the same sb_publishable_ key from your currently working app.js here.
// Never use a service_role or secret key in a browser app.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wk15NsgFvDCkZbUuHVeyWg_YEHveiFp';
const $ = (id) => document.getElementById(id);

let db = null, charts = {financeChart:null,dashboardFinanceChart:null}, allTransactions = [], allCategories = [], categoryChannel = null, editingTransactionId = null;
let transactionPage = 1;
let calendarMonth = localDate(new Date()).slice(0,7);
const TRANSACTIONS_PER_PAGE = 10;
// Theme preference is stored locally on this device; it does not affect family data.
const THEME_STORAGE_KEY = 'family-finance-theme';
function applyTheme(theme){
 const selected = theme === 'dark' ? 'dark' : 'light';
 document.documentElement.dataset.theme = selected;
 const button = $('themeToggle');
 if(button){
  const dark = selected === 'dark';
  button.setAttribute('aria-pressed',String(dark));
  button.setAttribute('aria-label',dark?'ប្ដូរទៅ Light Mode':'ប្ដូរទៅ Dark Mode');
  button.title = dark ? 'ប្ដូរទៅ Light Mode' : 'ប្ដូរទៅ Dark Mode';
  button.innerHTML = '<span class="theme-icon" aria-hidden="true">'+(dark?'☀️':'🌙')+'</span><span class="theme-label">'+(dark?'Light Mode':'Dark Mode')+'</span>';
 }
 Object.values(charts).forEach(chart=>{
  if(!chart)return;
  const dark = selected === 'dark';
  const tickColor = dark ? '#c2cede' : '#718096';
  const gridColor = dark ? 'rgba(190,205,225,.14)' : 'rgba(120,140,165,.16)';
  if(chart.options.scales?.x){chart.options.scales.x.ticks={...chart.options.scales.x.ticks,color:tickColor};chart.options.scales.x.grid={...chart.options.scales.x.grid,color:gridColor};}
  if(chart.options.scales?.y){chart.options.scales.y.ticks={...chart.options.scales.y.ticks,color:tickColor};chart.options.scales.y.grid={...chart.options.scales.y.grid,color:gridColor};}
  if(chart.options.plugins?.legend)chart.options.plugins.legend.labels={...chart.options.plugins.legend.labels,color:tickColor};
  chart.update('none');
 });
}
let savedTheme = 'light';
try{savedTheme=localStorage.getItem(THEME_STORAGE_KEY)||'light'}catch(error){}
applyTheme(savedTheme);
$('themeToggle').addEventListener('click',()=>{
 const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
 applyTheme(next);
 try{localStorage.setItem(THEME_STORAGE_KEY,next)}catch(error){}
});

const KEY_PLACEHOLDER = 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE';
const configured = SUPABASE_PUBLISHABLE_KEY !== KEY_PLACEHOLDER && SUPABASE_PUBLISHABLE_KEY.length > 20;

if (configured && window.supabase?.createClient) db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const money = (v) => new Intl.NumberFormat('km-KH',{maximumFractionDigits:0}).format(Number(v)||0)+' ៛';
const setMessage=(id,msg,error=false)=>{const el=$(id);el.textContent=msg;el.classList.toggle('error',error)};
let toastTimer=null;
function showToast(message,error=false){
 let toast=$('appToast');
 if(!toast){toast=document.createElement('div');toast.id='appToast';toast.className='app-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.appendChild(toast)}
 toast.textContent=message;
 toast.classList.toggle('error',error);
 toast.classList.add('visible');
 if(toastTimer)clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>toast.classList.remove('visible'),3600);
}
const today = new Date(); $('date').value = localDate(today);
populateMonthOptions(localDate(today).slice(0,7));
$('yearFilter').innerHTML = `<option value="${today.getFullYear()}">${today.getFullYear()}</option>`;
 $('yearFilter').value = String(today.getFullYear());
if(!configured) $('setupNotice').classList.remove('hidden');
function localDate(d){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
$('togglePassword').addEventListener('click',()=>{
 const passwordInput=$('password');
 const show=passwordInput.type==='password';
 passwordInput.type=show?'text':'password';
 $('togglePassword').setAttribute('aria-pressed',String(show));
 $('togglePassword').setAttribute('aria-label',show?'លាក់ Password':'បង្ហាញ Password');
 $('togglePassword').innerHTML='<span aria-hidden="true">'+(show?'◉':'◎')+'</span>';
});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return setMessage('loginMessage','សូមបញ្ចូល Publishable Key ក្នុង app.js ជាមុនសិន។',true);setMessage('loginMessage','កំពុងពិនិត្យគណនី...');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)return setMessage('loginMessage',error.message,true);setMessage('loginMessage','បានចូលគណនីដោយជោគជ័យ។')});
$('logoutBtn').addEventListener('click',async()=>{if(db)await db.auth.signOut();showLogin()});
$('refreshBtn').addEventListener('click',async()=>{
 const button=$('refreshBtn'),message=$('refreshMessage');
 if(button.disabled)return;
 button.disabled=true;button.innerHTML='<span aria-hidden="true">↻</span><span>កំពុងធ្វើបច្ចុប្បន្នភាព...</span>';
 message.textContent='កំពុងទាញយកទិន្នន័យថ្មីពី Supabase...';message.classList.remove('error');
 try{
  const results=await Promise.all([loadCategories(),loadTransactions()]);
  if(results.every(Boolean)){message.textContent='បានធ្វើបច្ចុប្បន្នភាពទិន្នន័យដោយជោគជ័យ។';}
  else{message.textContent='មិនអាចធ្វើបច្ចុប្បន្នភាពទិន្នន័យបានទេ។ សូមពិនិត្យការភ្ជាប់ ឬសាកល្បងម្ដងទៀត។';message.classList.add('error');}
 }catch(error){message.textContent='មានបញ្ហាក្នុងការធ្វើបច្ចុប្បន្នភាព៖ '+error.message;message.classList.add('error');}
 finally{button.disabled=false;button.innerHTML='<span aria-hidden="true">↻</span><span>Refresh</span>';}
});$('monthFilter').addEventListener('change',()=>{transactionPage=1;renderDashboard()});$('yearFilter').addEventListener('change',renderDashboard);$('chartMode').addEventListener('change',()=>{ $('dashboardChartMode').value=$('chartMode').value;renderChart('financeChart');renderChart('dashboardFinanceChart') });$('dashboardChartMode').addEventListener('change',()=>{ $('chartMode').value=$('dashboardChartMode').value;renderChart('financeChart');renderChart('dashboardFinanceChart') });$('exportAnnualExcelBtn').addEventListener('click',exportAnnualExcel);$('exportExcelBtn').addEventListener('click',exportMonthlyExcel);$('exportPdfBtn').addEventListener('click',exportMonthlyPdf);$('type').addEventListener('change',renderCategoryOptions);$('addCategoryBtn').addEventListener('click',addCategory);$('categoryRows').addEventListener('click',handleCategoryAction);
$('transactionForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return;setMessage('formMessage','កំពុងរក្សាទុក...');const payload={transaction_type:$('type').value,amount:Number($('amount').value),currency:'KHR',category:$('category').value.trim(),description:$('description').value.trim()||null,transaction_date:$('date').value};const wasEditing=Boolean(editingTransactionId);try{const query=editingTransactionId?db.from('transactions').update(payload).eq('id',editingTransactionId):db.from('transactions').insert(payload);const {error}=await query;if(error){setMessage('formMessage','មិនអាចរក្សាទុកបានទេ៖ '+error.message,true);showToast('មិនអាចរក្សាទុកប្រតិបត្តិការបានទេ។',true);return}resetTransactionForm();closeTransactionModal();const successMessage=wasEditing?'បានកែប្រែប្រតិបត្តិការដោយជោគជ័យ។':'បានរក្សាទុកប្រតិបត្តិការដោយជោគជ័យ។';setMessage('formMessage',successMessage);showToast(successMessage);await loadTransactions()}catch(error){setMessage('formMessage','មានបញ្ហា៖ '+error.message,true);showToast('មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ។',true)}});
$('cancelEditBtn').addEventListener('click',()=>{resetTransactionForm();closeTransactionModal()});
let appLoadingPromise=null,appVisible=false;
async function showApp(){
 if(appVisible)return;
 if(appLoadingPromise)return appLoadingPromise;
 appLoadingPromise=(async()=>{
  $('loginPanel').classList.add('hidden');document.body.classList.add('app-authenticated');$('appPanel').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');$('refreshBtn').classList.remove('hidden');$('themeToggle').classList.remove('hidden');
  await Promise.all([loadCategories(),loadTransactions()]);
  subscribeCategories();appVisible=true;
 })();
 try{return await appLoadingPromise}finally{appLoadingPromise=null}
}
function showLogin(){appVisible=false;if(categoryChannel&&db){db.removeChannel(categoryChannel);categoryChannel=null}document.body.classList.remove('app-authenticated');$('appPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden');$('logoutBtn').classList.add('hidden');$('refreshBtn').classList.add('hidden');$('themeToggle').classList.add('hidden')}

async function loadCategories(){
 if(!db)return false;
 const {data,error}=await db.from('categories').select('id,transaction_type,name').order('name',{ascending:true});
 if(error){setMessage('categoryMessage','មិនអាចផ្ទុកប្រភេទបាន៖ '+error.message,true);return false}
 allCategories=data||[];renderCategoryOptions();renderCategoryRows();return true;
}
function renderCategoryOptions(){
 const type=$('type').value;const current=$('category').value;
 const options=allCategories.filter(c=>c.transaction_type===type);
 $('category').innerHTML='<option value="">ជ្រើសរើសប្រភេទ</option>'+options.map(c=>'<option value="'+escapeHtml(c.name)+'">'+escapeHtml(c.name)+'</option>').join('');
 if(options.some(c=>c.name===current))$('category').value=current;
 const filter=$('transactionCategoryFilter');
 if(filter){
  const selected=filter.value;
  const filterType=$('transactionTypeFilter').value;
  const filterCategories=allCategories.filter(c=>!filterType||c.transaction_type===filterType);
  filter.innerHTML='<option value="">គ្រប់ប្រភេទ</option>'+filterCategories.map(c=>'<option value="'+escapeHtml(c.name)+'">'+escapeHtml(c.name)+(c.transaction_type==='income'?' · ចំណូល':' · ចំណាយ')+'</option>').join('');
  if(filterCategories.some(c=>c.name===selected))filter.value=selected;
  else filter.value='';
 }
}
function renderCategoryRows(){
 const rows=allCategories;
 if(!rows.length){$('categoryRows').innerHTML='<span class="muted">មិនទាន់មានប្រភេទទេ។ សូមចុច បន្ថែមប្រភេទ។</span>';return}
 $('categoryRows').innerHTML=['income','expense'].map(type=>{
 const title=type==='income'?'ចំណូល':'ចំណាយ';
 const items=rows.filter(c=>c.transaction_type===type);
 return '<div class="category-group"><strong>'+title+'</strong><div class="category-chips">'+(items.length?items.map(c=>'<div class="category-chip"><span class="category-name">'+escapeHtml(c.name)+'</span><div class="category-actions"><button class="category-edit-btn" type="button" data-edit-category="'+c.id+'" aria-label="កែឈ្មោះ '+escapeHtml(c.name)+'" title="កែឈ្មោះប្រភេទ">កែ</button><button class="category-delete-btn" type="button" data-delete-category="'+c.id+'" aria-label="លុប '+escapeHtml(c.name)+'" title="លុបប្រភេទ">លុប</button></div></div>').join(''):'<span class="muted">មិនទាន់មាន</span>')+'</div></div>';
 }).join('');
}
function addCategory(){
 const modal=ensureTransactionModal();
 const body=modal.querySelector('#transactionModalBody');
 body.innerHTML='<form id="categoryAddForm" class="form-grid"><label class="full">ប្រភេទ<select id="newCategoryType" required><option value="income">ប្រភេទចំណូល</option><option value="expense">ប្រភេទចំណាយ</option></select></label><label class="full">ឈ្មោះប្រភេទ<input id="newCategoryName" type="text" maxlength="80" required placeholder="បញ្ចូលឈ្មោះប្រភេទថ្មី"></label><div class="full delete-confirm-actions"><button type="button" class="btn btn-light" data-category-cancel>បោះបង់</button><button type="submit" class="btn btn-primary">＋ រក្សាទុកប្រភេទ</button></div></form>';
 $('transactionModalTitle').textContent='បន្ថែមប្រភេទថ្មី';
 body.querySelector('[data-category-cancel]').addEventListener('click',()=>modal.close());
 body.querySelector('#categoryAddForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const type=body.querySelector('#newCategoryType').value;
  const name=body.querySelector('#newCategoryName').value.trim();
  if(!name){body.querySelector('#newCategoryName').focus();return}
  const submit=body.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='កំពុងរក្សាទុក...';
  const {error}=await db.from('categories').insert({transaction_type:type,name});
  if(error){setMessage('categoryMessage',error.code==='23505'?'ប្រភេទនេះមានរួចហើយ។':error.message,true);submit.disabled=false;submit.textContent='＋ រក្សាទុកប្រភេទ';return}
  modal.close();
  setMessage('categoryMessage','បានបន្ថែមប្រភេទ'+(type==='income'?'ចំណូល':'ចំណាយ')+'ថ្មីដោយជោគជ័យ។');
  await loadCategories();
 });
 if(!modal.open)modal.showModal();
 body.querySelector('#newCategoryName').focus();
}
function openCategoryModal(title,content){
 const modal=ensureTransactionModal();
 modal.querySelector('#transactionModalTitle').textContent=title;
 modal.querySelector('#transactionModalBody').innerHTML=content;
 if(!modal.open)modal.showModal();
 return modal;
}
async function handleCategoryAction(e){
 const edit=e.target.closest('[data-edit-category]');
 const del=e.target.closest('[data-delete-category]');
 if(edit){
  const item=allCategories.find(c=>c.id===edit.dataset.editCategory);if(!item)return;
  const modal=openCategoryModal('កែឈ្មោះប្រភេទ','<form id="categoryEditForm" class="form-grid"><label class="full">ប្រភេទ<input type="text" value="'+(item.transaction_type==='income'?'ចំណូល':'ចំណាយ')+'" disabled></label><label class="full">ឈ្មោះប្រភេទ<input id="editCategoryName" type="text" maxlength="80" required value="'+escapeHtml(item.name)+'"></label><div class="full delete-confirm-actions"><button type="button" class="btn btn-light" data-category-cancel>បោះបង់</button><button type="submit" class="btn btn-primary">រក្សាទុកការកែប្រែ</button></div><p class="message full" id="categoryEditMessage" role="status"></p></form>');
  const body=modal.querySelector('#transactionModalBody');
  body.querySelector('[data-category-cancel]').addEventListener('click',()=>modal.close());
  body.querySelector('#categoryEditForm').addEventListener('submit',async ev=>{
   ev.preventDefault();
   const input=body.querySelector('#editCategoryName'),clean=input.value.trim(),submit=body.querySelector('button[type="submit"]');
   if(!clean){input.focus();return}
   submit.disabled=true;submit.textContent='កំពុងរក្សាទុក...';
   const {error}=await db.from('categories').update({name:clean}).eq('id',item.id);
   if(error){setMessage('categoryEditMessage',error.code==='23505'?'ឈ្មោះប្រភេទនេះមានរួចហើយ។':error.message,true);submit.disabled=false;submit.textContent='រក្សាទុកការកែប្រែ';return}
   modal.close();setMessage('categoryMessage','បានកែឈ្មោះប្រភេទដោយជោគជ័យ។');await loadCategories();
  });
  body.querySelector('#editCategoryName').focus({preventScroll:true});
 }
 if(del){
  const item=allCategories.find(c=>c.id===del.dataset.deleteCategory);if(!item)return;
  const {count,error:checkError}=await db.from('transactions').select('id',{count:'exact',head:true}).eq('transaction_type',item.transaction_type).eq('category',item.name);
  if(checkError){setMessage('categoryMessage',checkError.message,true);return}
  if(count>0){
   const modal=openCategoryModal('មិនអាចលុបប្រភេទនេះបានទេ','<div class="delete-confirm-content"><p>ប្រភេទ «'+escapeHtml(item.name)+'» មិនអាចលុបបានទេ។</p><p class="muted">ព្រោះប្រភេទនេះមានក្នុងប្រវត្តិប្រតិបត្តិការ។ សូមរក្សាទុកប្រវត្តិទិន្នន័យ ឬកែប្រភេទប្រតិបត្តិការជាមុនសិន។</p><div class="delete-confirm-actions"><button type="button" class="btn btn-primary" data-category-cancel>យល់ព្រម</button></div></div>');
   modal.querySelector('[data-category-cancel]').addEventListener('click',()=>modal.close());
   return;
  }
  const modal=openCategoryModal('បញ្ជាក់ការលុបប្រភេទ','<div class="delete-confirm-content"><p>តើអ្នកប្រាកដថាចង់លុបប្រភេទ «'+escapeHtml(item.name)+'» មែនទេ?</p><p class="muted">ប្រភេទ៖ '+(item.transaction_type==='income'?'ចំណូល':'ចំណាយ')+'</p><div class="delete-confirm-actions"><button type="button" class="btn btn-light" data-category-cancel>បោះបង់</button><button type="button" class="btn btn-danger" data-category-delete>បញ្ជាក់លុប</button></div><p class="message" id="categoryDeleteMessage" role="status"></p></div>');
  const body=modal.querySelector('#transactionModalBody');
  body.querySelector('[data-category-cancel]').addEventListener('click',()=>modal.close());
  body.querySelector('[data-category-delete]').addEventListener('click',async ev=>{
   const button=ev.currentTarget;button.disabled=true;button.textContent='កំពុងលុប...';
   const {error}=await db.from('categories').delete().eq('id',item.id);
   if(error){setMessage('categoryDeleteMessage',error.message,true);button.disabled=false;button.textContent='បញ្ជាក់លុប';return}
   modal.close();setMessage('categoryMessage','បានលុបប្រភេទដោយជោគជ័យ។');await loadCategories();
  });
 }
}
function subscribeCategories(){
 if(!db||categoryChannel)return;
 categoryChannel=db.channel('family-finance-categories').on('postgres_changes',{event:'*',schema:'public',table:'categories'},()=>loadCategories()).subscribe();
}

async function loadTransactions(){if(!db)return false;const {data,error}=await db.from('transactions').select('id,transaction_type,amount,currency,category,description,transaction_date,created_at').order('created_at',{ascending:false,nullsFirst:false}).order('transaction_date',{ascending:false});if(error){$('transactionRows').innerHTML=`<tr><td colspan="5" class="empty">${escapeHtml(error.message)}</td></tr>`;return false}allTransactions=data||[];populateMonthOptions();populateYearOptions();renderDashboard();return true}

function populateMonthOptions(preferredValue){
 const currentMonth=localDate(new Date()).slice(0,7);
 const selected=preferredValue||$('monthFilter').value||currentMonth;
 const years=new Set([String(new Date().getFullYear()),...allTransactions.map(x=>(x.transaction_date||'').slice(0,4)).filter(y=>y.length===4&&Number.isInteger(Number(y))),selected.slice(0,4)]);
 const months=[];
 const formatter=new Intl.DateTimeFormat('km-KH',{month:'long'});
 [...years].sort((a,b)=>Number(b)-Number(a)).forEach(year=>{
  for(let month=1;month<=12;month++){
   const value=year+'-'+String(month).padStart(2,'0');
   const label=formatter.format(new Date(Number(year),month-1,1));
   months.push('<option value="'+value+'">'+label+' '+year+'</option>');
  }
 });
 $('monthFilter').innerHTML=months.join('');
 $('monthFilter').value=selected;
 if(!$('monthFilter').value)$('monthFilter').value=currentMonth;
}

function populateYearOptions(){
 const selected=$('yearFilter').value||String(new Date().getFullYear());
 const years=new Set([String(new Date().getFullYear()),...allTransactions.map(x=>(x.transaction_date||'').slice(0,4)).filter(y=>/^\\d{4}$/.test(y))]);
 $('yearFilter').innerHTML=[...years].sort((a,b)=>Number(b)-Number(a)).map(year=>'<option value="'+year+'">'+year+'</option>').join('');
 $('yearFilter').value=years.has(selected)?selected:String(new Date().getFullYear());
}

function exportAnnualExcel(){
 const year=$('yearFilter').value||String(new Date().getFullYear());
 const rows=allTransactions.filter(x=>(x.transaction_date||'').startsWith(year));
 if(!rows.length){setMessage('exportMessage','មិនមានប្រតិបត្តិការក្នុងឆ្នាំ '+year+' សម្រាប់ Export ទេ។',true);return}
 if(!window.XLSX){setMessage('exportMessage','មិនអាចផ្ទុកមុខងារ Excel បានទេ។ សូម Refresh ទំព័រ ហើយសាកល្បងម្ដងទៀត។',true);return}
 const sum=(items,type)=>items.filter(x=>x.transaction_type===type).reduce((n,x)=>n+(Number(x.amount)||0),0);
 const income=sum(rows,'income'),expense=sum(rows,'expense');
 const monthly=[['ខែ','ចំណូលសរុប','ចំណាយសរុប','សមតុល្យ','ចំនួនប្រតិបត្តិការ']];
 for(let m=1;m<=12;m++){const key=year+'-'+String(m).padStart(2,'0');const items=rows.filter(x=>(x.transaction_date||'').startsWith(key));monthly.push([key,sum(items,'income'),sum(items,'expense'),sum(items,'income')-sum(items,'expense'),items.length])}
 const grouped={};rows.forEach(x=>{const type=x.transaction_type==='income'?'ចំណូល':'ចំណាយ';const category=x.category||'មិនបានកំណត់';const key=type+'::'+category;if(!grouped[key])grouped[key]={type,category,total:0,count:0};grouped[key].total+=(Number(x.amount)||0);grouped[key].count++});
 const categories=[['ប្រភេទ','ឈ្មោះប្រភេទ','ចំនួនទឹកប្រាក់','ចំនួនប្រតិបត្តិការ'],...Object.values(grouped).sort((a,b)=>a.type.localeCompare(b.type)||b.total-a.total).map(x=>[x.type,x.category,x.total,x.count])];
 const details=[['កាលបរិច្ឆេទ','ប្រភេទ','ប្រភេទចំណូល/ចំណាយ','កំណត់ចំណាំ','ចំនួនទឹកប្រាក់','រូបិយប័ណ្ណ'],...rows.slice().sort((a,b)=>(a.transaction_date||'').localeCompare(b.transaction_date||'')).map(x=>[x.transaction_date||'',x.transaction_type==='income'?'ចំណូល':'ចំណាយ',x.category||'',x.description||'',Number(x.amount)||0,x.currency||'KHR'])];
 const summary=[['FAMILY FINANCE - ANNUAL REPORT'],['ឆ្នាំរបាយការណ៍',year],['រូបិយប័ណ្ណ','KHR (៛)'],[],['សូចនាករ','ចំនួនទឹកប្រាក់'],['ចំណូលសរុប',income],['ចំណាយសរុប',expense],['សមតុល្យសុទ្ធ',income-expense],['ចំនួនប្រតិបត្តិការ',rows.length],['កាលបរិច្ឆេទ Export',localDate(new Date())]];
 const wb=XLSX.utils.book_new();
 const sheets=[['Summary',summary,[{wch:28},{wch:22}]],['Monthly Summary',monthly,[{wch:18},{wch:20},{wch:20},{wch:20},{wch:22}]],['By Category',categories,[{wch:16},{wch:28},{wch:22},{wch:22}]],['Transactions',details,[{wch:16},{wch:14},{wch:26},{wch:38},{wch:20},{wch:14}]]];
 sheets.forEach(([name,data,cols])=>{const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=cols;if(name==='Summary')['B6','B7','B8'].forEach(ref=>{if(ws[ref])ws[ref].z='#,##0 "៛"'});if(name==='Monthly Summary'||name==='By Category'){for(let r=2;r<=data.length;r++){const refs=name==='Monthly Summary'?['B','C','D']:['C'];refs.forEach(col=>{if(ws[col+r])ws[col+r].z='#,##0 "៛"'})}}if(name==='Transactions'){for(let r=2;r<=data.length;r++)if(ws['E'+r])ws['E'+r].z='#,##0 "៛"';ws['!autofilter']={ref:'A1:F'+data.length}}XLSX.utils.book_append_sheet(wb,ws,name)});
 wb.Props={Title:'Family Finance Annual Report '+year,Subject:'Annual income and expense report',Author:'Family Finance'};
 XLSX.writeFile(wb,'Family-Finance-Annual-'+year+'.xlsx',{compression:true});
 setMessage('exportMessage','បានបង្កើតរបាយការណ៍ Excel ប្រចាំឆ្នាំ '+year+' ដោយជោគជ័យ។');
}

function exportMonthlyExcel(){
 const month=$('monthFilter').value;
 if(!month){setMessage('exportMessage','សូមជ្រើសរើសខែជាមុនសិន។',true);return}
 if(!window.XLSX){setMessage('exportMessage','មិនអាចផ្ទុកមុខងារ Excel បានទេ។ សូម Refresh ទំព័រ ហើយសាកល្បងម្ដងទៀត។',true);return}
 const rows=allTransactions.filter(x=>(x.transaction_date||'').startsWith(month));
 if(!rows.length){setMessage('exportMessage','មិនមានប្រតិបត្តិការក្នុងខែនេះសម្រាប់ Export ទេ។',true);return}
 const income=rows.filter(x=>x.transaction_type==='income').reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const expense=rows.filter(x=>x.transaction_type==='expense').reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const summaryData=[
  ['FAMILY FINANCE - MONTHLY REPORT'],
  ['ខែរបាយការណ៍',month],
  ['រូបិយប័ណ្ណ','KHR (៛)'],
  [],
  ['សូចនាករ','ចំនួនទឹកប្រាក់'],
  ['ចំណូលសរុប',income],
  ['ចំណាយសរុប',expense],
  ['សមតុល្យសុទ្ធ',income-expense],
  ['ចំនួនប្រតិបត្តិការ',rows.length],
  ['កាលបរិច្ឆេទ Export',localDate(new Date())]
 ];
 const detailRows=[['កាលបរិច្ឆេទ','ប្រភេទ','ប្រភេទចំណូល/ចំណាយ','កំណត់ចំណាំ','ចំនួនទឹកប្រាក់','រូបិយប័ណ្ណ']];
 rows.slice().sort((a,b)=>(a.transaction_date||'').localeCompare(b.transaction_date||'')).forEach(x=>{
  detailRows.push([x.transaction_date||'',x.transaction_type==='income'?'ចំណូល':'ចំណាយ',x.category||'',x.description||'',Number(x.amount)||0,x.currency||'KHR']);
 });
 const grouped={};
 rows.forEach(x=>{
  const type=x.transaction_type==='income'?'ចំណូល':'ចំណាយ';
  const category=x.category||'មិនបានកំណត់';
  const key=type+'::'+category;
  if(!grouped[key])grouped[key]={type,category,total:0,count:0};
  grouped[key].total+=Number(x.amount)||0;
  grouped[key].count+=1;
 });
 const categoryRows=[['ប្រភេទ','ប្រភេទចំណូល/ចំណាយ','ចំនួនទឹកប្រាក់','ចំនួនប្រតិបត្តិការ']];
 Object.values(grouped).sort((a,b)=>a.type.localeCompare(b.type)||a.category.localeCompare(b.category)).forEach(x=>categoryRows.push([x.type,x.category,x.total,x.count]));
 const wb=XLSX.utils.book_new();
 const summarySheet=XLSX.utils.aoa_to_sheet(summaryData);
 const detailSheet=XLSX.utils.aoa_to_sheet(detailRows);
 const categorySheet=XLSX.utils.aoa_to_sheet(categoryRows);
 summarySheet['!cols']=[{wch:28},{wch:22}];
 detailSheet['!cols']=[{wch:16},{wch:14},{wch:25},{wch:38},{wch:20},{wch:14}];
 categorySheet['!cols']=[{wch:14},{wch:28},{wch:22},{wch:22}];
 ['B6','B7','B8'].forEach(ref=>{if(summarySheet[ref])summarySheet[ref].z='#,##0 "៛"';});
 for(let r=2;r<=detailRows.length;r++){const cell=detailSheet['E'+r];if(cell)cell.z='#,##0 "៛"';}
 for(let r=2;r<=categoryRows.length;r++){const cell=categorySheet['C'+r];if(cell)cell.z='#,##0 "៛"';}
 detailSheet['!autofilter']={ref:'A1:F'+detailRows.length};
 categorySheet['!autofilter']={ref:'A1:D'+categoryRows.length};
 XLSX.utils.book_append_sheet(wb,summarySheet,'Summary');
 XLSX.utils.book_append_sheet(wb,detailSheet,'Transactions');
 XLSX.utils.book_append_sheet(wb,categorySheet,'By Category');
 wb.Props={Title:'Family Finance Monthly Report '+month,Subject:'Monthly income and expense report',Author:'Family Finance'};
 XLSX.writeFile(wb,'Family-Finance-'+month+'.xlsx',{compression:true});
 setMessage('exportMessage','បានបង្កើតរបាយការណ៍ Excel ប្រចាំខែ '+month+' ដោយជោគជ័យ។');
}


function exportMonthlyPdf(){
 const month=$('monthFilter').value;
 if(!month){setMessage('exportMessage','សូមជ្រើសរើសខែជាមុនសិន។',true);return}
 const rows=allTransactions.filter(x=>(x.transaction_date||'').startsWith(month));
 if(!rows.length){setMessage('exportMessage','មិនមានប្រតិបត្តិការក្នុងខែនេះសម្រាប់ Export ទេ។',true);return}
 const incomeRows=rows.filter(x=>x.transaction_type==='income').sort((a,b)=>(a.transaction_date||'').localeCompare(b.transaction_date||''));
 const expenseRows=rows.filter(x=>x.transaction_type==='expense').sort((a,b)=>(a.transaction_date||'').localeCompare(b.transaction_date||''));
 const income=incomeRows.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const expense=expenseRows.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const expenseGroups={};
 expenseRows.forEach(x=>{
  const category=(x.category||'មិនបានកំណត់').trim()||'មិនបានកំណត់';
  if(!expenseGroups[category])expenseGroups[category]={category,total:0,count:0};
  expenseGroups[category].total+=Number(x.amount)||0;
  expenseGroups[category].count+=1;
 });
 const topExpenseRows=Object.values(expenseGroups).sort((a,b)=>b.total-a.total||a.category.localeCompare(b.category));
 const topExpenseTotal=topExpenseRows.reduce((sum,x)=>sum+x.total,0);
 const topExpenseCount=topExpenseRows.reduce((sum,x)=>sum+x.count,0);
 const buildDetailRows=(items,emptyLabel,totalLabel,total)=>(
  (items.length?items.map((x,index)=>'<tr><td class="row-number">'+(index+1)+'</td><td>'+escapeHtml(x.transaction_date||'')+'</td><td>'+escapeHtml(x.category||'')+'</td><td>'+escapeHtml(x.description||'—')+'</td><td class="number">'+money(x.amount)+'</td></tr>').join(''):'<tr><td colspan="5" class="empty">'+emptyLabel+'</td></tr>')+
  '<tr class="pdf-total-row"><td colspan="4">'+totalLabel+'</td><td class="number">'+money(total)+'</td></tr>'
 );
 const incomeHtml=buildDetailRows(incomeRows,'មិនមានប្រតិបត្តិការចំណូលក្នុងខែនេះទេ។','សរុបចំណូល',income);
 const expenseHtml=buildDetailRows(expenseRows,'មិនមានប្រតិបត្តិការចំណាយក្នុងខែនេះទេ។','សរុបចំណាយ',expense);
 const topExpenseHtml=topExpenseRows.length?topExpenseRows.map((x,index)=>{
  const percent=topExpenseTotal>0?(x.total/topExpenseTotal)*100:0;
  return '<tr><td class="row-number">'+(index+1)+'</td><td>'+escapeHtml(x.category)+'</td><td class="number">'+money(x.total)+'</td><td class="number">'+x.count+'</td><td class="number">'+percent.toFixed(1)+'%</td></tr>';
 }).join(''):'<tr><td colspan="5" class="empty">មិនមានប្រតិបត្តិការចំណាយក្នុងខែនេះទេ។</td></tr>';
 const topExpenseTableHtml=topExpenseHtml+'<tr class="pdf-total-row"><td colspan="2">សរុបចំណាយ</td><td class="number">'+money(expense)+'</td><td class="number">'+expenseRows.length+'</td><td class="number">'+(expense>0?'100.0%':'0.0%')+'</td></tr>';
 const detailTable=(title,body)=>'<section class="pdf-section"><h2>'+title+'</h2><table class="pdf-table"><thead><tr><th class="row-number">ល.រ.</th><th>កាលបរិច្ឆេទ</th><th>ប្រភេទ</th><th>កំណត់ចំណាំ</th><th class="number">ចំនួនទឹកប្រាក់</th></tr></thead><tbody>'+body+'</tbody></table></section>';
 const report=$('pdfReport');
 report.innerHTML=
  '<header class="pdf-header">'+
   '<div class="pdf-brand">家 <span>Family Finance</span></div>'+
   '<h1>របាយការណ៍ចំណូល និងចំណាយប្រចាំខែ</h1>'+
   '<p>ខែរបាយការណ៍៖ <strong>'+escapeHtml(month)+'</strong></p>'+
   '<p>រូបិយប័ណ្ណ៖ KHR (៛) · កាលបរិច្ឆេទបង្កើត៖ '+escapeHtml(localDate(new Date()))+'</p>'+
  '</header>'+
  '<section class="pdf-section"><h2>១. សង្ខេបហិរញ្ញវត្ថុ (Summary)</h2>'+
   '<div class="pdf-summary">'+
    '<div><span>ចំណូលសរុប</span><strong class="pdf-income">'+money(income)+'</strong></div>'+
    '<div><span>ចំណាយសរុប</span><strong class="pdf-expense">'+money(expense)+'</strong></div>'+
    '<div><span>សមតុល្យសុទ្ធ</span><strong>'+money(income-expense)+'</strong></div>'+
    '<div><span>ចំនួនប្រតិបត្តិការ</span><strong>'+rows.length+'</strong></div>'+
   '</div></section>'+
  detailTable('២. តារាងប្រតិបត្តិការចំណូល (Income)',incomeHtml)+
  detailTable('៣. តារាងប្រតិបត្តិការចំណាយ (Expenses)',expenseHtml)+
  '<section class="pdf-section"><h2>៤. TOP EXPENSE CATEGORIES (ប្រភេទចំណាយច្រើនជាងគេក្នុងខែ)</h2>'+
   '<table class="pdf-table"><thead><tr><th class="row-number">ល.រ.</th><th>ប្រភេទចំណាយ</th><th class="number">ចំនួនទឹកប្រាក់</th><th class="number">ចំនួនប្រតិបត្តិការ</th><th class="number">ភាគរយ</th></tr></thead><tbody>'+topExpenseTableHtml+'</tbody></table></section>'+
  '<footer class="pdf-footer">Family Finance · របាយការណ៍សម្រាប់ប្រើប្រាស់ក្នុងគ្រួសារ</footer>';
 const oldTitle=document.title;
 report.classList.remove('hidden');
 document.title='Family-Finance-'+month;
 setMessage('exportMessage','សូមជ្រើសរើស “Save as PDF” ក្នុងផ្ទាំង Print ដើម្បីរក្សាទុករបាយការណ៍។');
 try{window.print()}catch(error){setMessage('exportMessage','មិនអាចបើកផ្ទាំង Print បានទេ៖ '+error.message,true)}
 report.classList.add('hidden');
 document.title=oldTitle;
}
function renderDashboard(){
 const month=$('monthFilter').value;
 const year=$('yearFilter').value||String(new Date().getFullYear());
 const rows=month?allTransactions.filter(x=>(x.transaction_date||'').startsWith(month)):allTransactions;
 let income=0,expense=0;
 for(const item of rows){const amount=Number(item.amount)||0;if(item.transaction_type==='income')income+=amount;else if(item.transaction_type==='expense')expense+=amount;}
 const yearRows=allTransactions.filter(x=>(x.transaction_date||'').startsWith(year));
 let yearIncome=0,yearExpense=0;
 for(const item of yearRows){const amount=Number(item.amount)||0;if(item.transaction_type==='income')yearIncome+=amount;else if(item.transaction_type==='expense')yearExpense+=amount;}
 const activeView=document.querySelector('.app-view:not(.hidden)')?.id||'dashboardView';
 if(activeView==='dashboardView'){
  $('monthIncome').textContent=money(income);$('monthExpense').textContent=money(expense);$('monthBalance').textContent=money(income-expense);
  $('recordCount').textContent=rows.length+' ប្រតិបត្តិការ';
  $('dashboardYearIncome').textContent=money(yearIncome);$('dashboardYearExpense').textContent=money(yearExpense);$('dashboardYearBalance').textContent=money(yearIncome-yearExpense);
  $('dashboardYearRecordCount').textContent=yearRows.length+' ប្រតិបត្តិការ';
  renderTopExpenseCategory(rows,'dashboardTopExpenseCategories','expense');
  renderTopExpenseCategory(rows,'dashboardTopIncomeCategories','income');
  renderDailyExpenseTable(rows);
  renderChart('dashboardFinanceChart');
 }else if(activeView==='summaryView'){
  $('incomeTotal').textContent=money(income);$('expenseTotal').textContent=money(expense);$('balanceTotal').textContent=money(income-expense);
  renderTopExpenseCategory(rows,'summaryTopExpenseCategories','expense');
  renderTopExpenseCategory(rows,'summaryTopIncomeCategories','income');
 }else if(activeView==='reportsView'){
  $('yearIncome').textContent=money(yearIncome);$('yearExpense').textContent=money(yearExpense);$('yearBalance').textContent=money(yearIncome-yearExpense);
  $('yearRecordCount').textContent=yearRows.length+' ប្រតិបត្តិការ';
  renderTopExpenseCategory(rows,'topExpenseCategories','expense');
  renderTopExpenseCategory(rows,'topIncomeCategories','income');
  renderChart('financeChart');
 }else if(activeView==='transactionsView'){
  renderTransactionCalendar();
  renderRows(rows);
 }
}
window.addEventListener('family-finance:viewchange',()=>renderDashboard());

function renderDailyExpenseTable(rows){
 const grouped={};
 rows.filter(item=>item.transaction_type==='expense').forEach(item=>{
  const date=item.transaction_date||'';
  if(!date)return;
  if(!grouped[date])grouped[date]={total:0,count:0};
  grouped[date].total+=Number(item.amount)||0;
  grouped[date].count+=1;
 });
 const days=Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0]));
 const target=$('dashboardDailyExpenseRows');
 const total=days.reduce((sum,[,item])=>sum+item.total,0);
 const count=days.reduce((sum,[,item])=>sum+item.count,0);
 $('dashboardDailyExpenseTotal').textContent=money(total);
 $('dashboardDailyExpenseCount').textContent=count+' ប្រតិបត្តិការ';
 target.innerHTML=days.length?days.map(([date,item],index)=>'<tr><td class="transaction-number">'+(index+1)+'</td><td>'+escapeHtml(date)+'</td><td class="amount-out">'+money(item.total)+'</td><td>'+item.count+' ប្រតិបត្តិការ</td></tr>').join(''):'<tr><td colspan="4" class="empty">មិនមានទិន្នន័យចំណាយក្នុងខែនេះទេ។</td></tr>';
}
function renderTopExpenseCategory(rows,targetId='topExpenseCategories',type='expense'){
  const grouped={};
  const categoryColors=['#e45757','#3478d4','#159574','#e5a52f','#8b5cf6','#e56b9f','#0f9db5','#8b9a35','#d97736','#64748b'];
  rows.filter(x=>x.transaction_type===type).forEach(x=>{
   const name=(x.category||'មិនបានកំណត់').trim()||'មិនបានកំណត់';
   if(!grouped[name])grouped[name]={total:0,count:0};
   grouped[name].total+=Number(x.amount)||0;
   grouped[name].count+=1;
  });
  const sorted=Object.entries(grouped).sort((a,b)=>b[1].total-a[1].total||a[0].localeCompare(b[0]));
  const categoryTotal=sorted.reduce((sum,[,item])=>sum+item.total,0);
  const totalCount=sorted.reduce((sum,[,item])=>sum+item.count,0);
  const label=type==='income'?'ចំណូល':'ចំណាយ';
  const totalSummary='<div class="top-category-total'+(type==='income'?' top-category-total--income':'')+'"><div class="top-category-total-labels"><span>សរុប'+label+'ទាំងអស់ក្នុងខែ</span><span>ចំនួនប្រតិបត្តិការសរុប</span></div><div class="top-category-total-values"><strong>'+money(categoryTotal)+'</strong><strong>'+totalCount+' ប្រតិបត្តិការ</strong></div></div>';
  $(targetId).innerHTML=sorted.length?totalSummary+sorted.map(([name,item],i)=>{
   const percent=categoryTotal>0?(item.total/categoryTotal)*100:0;
   const color=type==='income'?'#16A34A':categoryColors[i%categoryColors.length];
   return '<div class="top-category-row" style="--category-color:'+color+'"><span class="top-category-rank">'+(i+1)+'</span><span class="top-category-name">'+escapeHtml(name)+'<small class="top-category-meta">'+item.count+' ប្រតិបត្តិការ · '+percent.toFixed(1)+'%</small><span class="top-category-bar"><span style="width:'+percent.toFixed(2)+'%"></span></span></span><strong>'+money(item.total)+'</strong></div>';
  }).join(''):'<p class="muted">មិនទាន់មានទិន្នន័យ'+label+'ក្នុងខែនេះទេ។</p>';
}
function renderChart(canvasId='financeChart'){
 if(!window.Chart||!$(canvasId))return;
 const mode=$(canvasId==='dashboardFinanceChart'?'dashboardChartMode':'chartMode').value;
 const selectedYear=$('yearFilter').value||String(new Date().getFullYear());
 const grouped={};
 if(mode==='monthly'){
  for(let m=1;m<=12;m++){const key=selectedYear+'-'+String(m).padStart(2,'0');grouped[key]={income:0,expense:0}}
  allTransactions.filter(x=>(x.transaction_date||'').startsWith(selectedYear)).forEach(x=>{const key=(x.transaction_date||'').slice(0,7);if(grouped[key])grouped[key][x.transaction_type==='income'?'income':'expense']+=(Number(x.amount)||0)});
 }else{
  allTransactions.forEach(x=>{const year=(x.transaction_date||'').slice(0,4);if(!/^\d{4}$/.test(year))return;if(!grouped[year])grouped[year]={income:0,expense:0};grouped[year][x.transaction_type==='income'?'income':'expense']+=(Number(x.amount)||0)});
 }
 const keys=Object.keys(grouped).sort();
 const months=['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
 const labels=keys.map(k=>mode==='monthly'?months[Number(k.slice(5,7))-1]:k);
 const income=keys.map(k=>grouped[k].income),expense=keys.map(k=>grouped[k].expense);
 const data={labels,datasets:[{label:'ចំណូល',data:income,backgroundColor:'#159574',borderRadius:6},{label:'ចំណាយ',data:expense,backgroundColor:'#e47768',borderRadius:6}]};
 if(charts[canvasId]){
  charts[canvasId].data=data;
  charts[canvasId].update('none');
  return;
 }
 charts[canvasId]=new Chart($(canvasId),{type:'bar',data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.dataset.label+': '+money(c.raw)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>new Intl.NumberFormat('km-KH',{notation:'compact'}).format(v)}}}}});
}
function renderTransactionCalendar(){
 const grid=$('transactionCalendarGrid');if(!grid)return;
 const [year,month]=calendarMonth.split('-').map(Number);
 const first=new Date(year,month-1,1),daysInMonth=new Date(year,month,0).getDate();
 const offset=(first.getDay()+6)%7;
 const monthRows=allTransactions.filter(x=>(x.transaction_date||'').startsWith(calendarMonth));
 const monthNames=['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
 $('calendarMonthLabel').textContent=monthNames[month-1]+' '+year;
 const daily={};
 monthRows.forEach(x=>{const day=Number((x.transaction_date||'').slice(8,10));if(!day)return;if(!daily[day])daily[day]={income:0,expense:0,count:0};daily[day][x.transaction_type==='income'?'income':'expense']+=(Number(x.amount)||0);daily[day].count++});
 const selected=$('dateFromFilter').value&&$('dateFromFilter').value===$('dateToFilter').value?$('dateFromFilter').value:'';
 const cells=[];
 for(let i=0;i<offset;i++)cells.push('<span class="calendar-empty" aria-hidden="true"></span>');
 for(let day=1;day<=daysInMonth;day++){
  const item=daily[day]||{income:0,expense:0,count:0};
  const date=calendarMonth+'-'+String(day).padStart(2,'0');
  const active=selected===date;
  cells.push('<button type="button" class="calendar-day'+(item.count?' has-records':'')+(active?' selected':'')+'" data-calendar-date="'+date+'" aria-label="'+date+', '+item.count+' ប្រតិបត្តិការ" aria-pressed="'+active+'"><span class="calendar-day-number">'+day+'</span>'+(item.count?'<span class="calendar-day-count">'+item.count+' កំណត់ត្រា</span><span class="calendar-day-totals">'+(item.income?'<i class="calendar-income-dot"></i>':'')+(item.expense?'<i class="calendar-expense-dot"></i>':'')+'</span>':'')+'</button>');
 }
 grid.innerHTML=cells.join('');
 const clear=$('calendarSelectionMessage');
 clear.textContent=selected?'កំពុងបង្ហាញប្រតិបត្តិការថ្ងៃ '+selected:'ជ្រើសរើសថ្ងៃណាមួយ ដើម្បីត្រងប្រតិបត្តិការ';
}
function changeCalendarMonth(delta){
 const [year,month]=calendarMonth.split('-').map(Number);
 const date=new Date(year,month-1+delta,1);
 calendarMonth=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
 renderTransactionCalendar();
}
$('calendarPrev').addEventListener('click',()=>changeCalendarMonth(-1));
$('calendarNext').addEventListener('click',()=>changeCalendarMonth(1));
$('calendarClearFilter').addEventListener('click',()=>{
 $('dateFromFilter').value='';$('dateToFilter').value='';transactionPage=1;renderDashboard();
});
$('transactionCalendarGrid').addEventListener('click',event=>{
 const day=event.target.closest('[data-calendar-date]');if(!day)return;
 const date=day.dataset.calendarDate;
 $('dateFromFilter').value=date;$('dateToFilter').value=date;transactionPage=1;renderDashboard();
});
function renderRows(rows){
 const query=$('transactionSearch').value.trim().toLowerCase();
 const type=$('transactionTypeFilter').value;
 const category=$('transactionCategoryFilter').value;
 const from=$('dateFromFilter').value;
 const to=$('dateToFilter').value;
 const filtered=rows.filter(x=>{
  const searchable=[x.category,x.description,x.amount,x.transaction_type].join(' ').toLowerCase();
  return (!query||searchable.includes(query))&&(!type||x.transaction_type===type)&&(!category||x.category===category)&&(!from||x.transaction_date>=from)&&(!to||x.transaction_date<=to);
 });
 const incomeTotal=filtered.filter(x=>x.transaction_type==='income').reduce((s,x)=>s+(Number(x.amount)||0),0);
 const expenseTotal=filtered.filter(x=>x.transaction_type==='expense').reduce((s,x)=>s+(Number(x.amount)||0),0);
 const netTotal=incomeTotal-expenseTotal;
 $('transactionSummary').innerHTML='<article class="search-total income"><span>ចំណូលសរុប</span><strong>'+money(incomeTotal)+'</strong></article><article class="search-total expense"><span>ចំណាយសរុប</span><strong>'+money(expenseTotal)+'</strong></article><article class="search-total balance"><span>សមតុល្យសុទ្ធ</span><strong>'+money(netTotal)+'</strong></article><article class="search-total count"><span>ចំនួនប្រតិបត្តិការ</span><strong>'+filtered.length+' ប្រតិបត្តិការ</strong></article>';
 const pageCount=Math.ceil(filtered.length/TRANSACTIONS_PER_PAGE);
 transactionPage=Math.max(1,Math.min(transactionPage,Math.max(1,pageCount)));
 if(!filtered.length){
  $('transactionRows').innerHTML='<tr><td colspan="5" class="empty">រកមិនឃើញប្រតិបត្តិការដែលត្រូវនឹងលក្ខខណ្ឌស្វែងរកទេ</td></tr>';
  $('transactionPagination').innerHTML='';
  return;
 }
 const startIndex=(transactionPage-1)*TRANSACTIONS_PER_PAGE;
 const pageRows=filtered.slice(startIndex,startIndex+TRANSACTIONS_PER_PAGE);
 $('transactionRows').innerHTML=pageRows.map((x,index)=>`<tr><td class="transaction-number">${startIndex+index+1}</td><td>${escapeHtml(x.transaction_date||'')}</td><td><strong>${escapeHtml(x.category)}</strong><br><span class="muted">${escapeHtml(x.description||(x.transaction_type==='income'?'ចំណូល':'ចំណាយ'))}</span></td><td class="${x.transaction_type==='income'?'amount-in':'amount-out'}">${x.transaction_type==='income'?'+':'−'}${money(x.amount)}</td><td><button class="edit" data-edit="${x.id}" aria-label="កែប្រែប្រតិបត្តិការ" title="កែប្រែ">✎ កែ</button> <button class="duplicate" data-duplicate="${x.id}" aria-label="ចម្លងប្រតិបត្តិការ" title="ចម្លងប្រតិបត្តិការ">⧉ ចម្លង</button> <button class="delete" data-delete="${x.id}" aria-label="លុបប្រតិបត្តិការ" title="លុប"><svg class="delete-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg> លុប</button></td></tr>`).join('');
 const pageButtons=[];
 const firstPage=Math.max(1,transactionPage-2);
 const lastPage=Math.min(pageCount,firstPage+4);
 for(let page=firstPage;page<=lastPage;page++)pageButtons.push('<button type="button" class="pagination-page'+(page===transactionPage?' active':'')+'" data-page="'+page+'" aria-label="ទំព័រ '+page+'" aria-current="'+(page===transactionPage?'page':'false')+'">'+page+'</button>');
 $('transactionPagination').innerHTML='<span class="pagination-info">បង្ហាញ '+(startIndex+1)+'–'+Math.min(startIndex+TRANSACTIONS_PER_PAGE,filtered.length)+' ក្នុង '+filtered.length+' ប្រតិបត្តិការ</span><div class="pagination-controls"><button type="button" class="pagination-nav" data-page="'+(transactionPage-1)+'" '+(transactionPage===1?'disabled':'')+'>មុន</button>'+pageButtons.join('')+'<button type="button" class="pagination-nav" data-page="'+(transactionPage+1)+'" '+(transactionPage===pageCount?'disabled':'')+'>បន្ទាប់</button></div>';
}
let transactionModal=null,transactionFormHome=null,transactionFormNext=null;
function ensureTransactionModal(){
 if(transactionModal)return transactionModal;
 transactionFormHome=$('transactionForm').parentNode;transactionFormNext=$('transactionForm').nextSibling;
 transactionModal=document.createElement('dialog');transactionModal.className='transaction-modal';
 transactionModal.innerHTML='<div class="transaction-modal-head"><h3 id="transactionModalTitle">ប្រតិបត្តិការ</h3><button type="button" class="transaction-modal-close" aria-label="បិទ">×</button></div><div class="transaction-modal-body" id="transactionModalBody"></div>';
 document.body.appendChild(transactionModal);
 transactionModal.querySelector('.transaction-modal-close').addEventListener('click',()=>transactionModal.close());
 transactionModal.addEventListener('click',e=>{if(e.target===transactionModal)transactionModal.close()});
 transactionModal.addEventListener('close',()=>{if($('transactionForm').parentNode===transactionModal.querySelector('#transactionModalBody')){transactionFormHome.insertBefore($('transactionForm'),transactionFormNext);resetTransactionForm()}});
 return transactionModal;
}
function openTransactionModal(title){
 const modal=ensureTransactionModal();$('transactionModalTitle').textContent=title;
 modal.querySelector('#transactionModalBody').appendChild($('transactionForm'));
 if(!modal.open)modal.showModal();
}
function closeTransactionModal(){if(transactionModal?.open)transactionModal.close()}
function showDeleteConfirmation(item){
 const modal=ensureTransactionModal();
 modal.querySelector('#transactionModalBody').innerHTML='<div class="delete-confirm-content"><p>តើអ្នកប្រាកដថាចង់លុបប្រតិបត្តិការនេះមែនទេ?</p><p class="muted">'+escapeHtml(item.category||'')+' · '+escapeHtml(item.transaction_date||'')+' · '+money(item.amount)+'</p><div class="delete-confirm-actions"><button type="button" class="btn btn-light" data-modal-cancel>បោះបង់</button><button type="button" class="btn btn-danger" data-modal-delete>បញ្ជាក់លុប</button></div></div>';
 modal.querySelector('#transactionModalTitle').textContent='បញ្ជាក់ការលុប';
 return new Promise(resolve=>{
  const onClose=()=>{modal.removeEventListener('close',onClose);resolve(false)};
  modal.addEventListener('close',onClose,{once:true});
  modal.querySelector('[data-modal-cancel]').addEventListener('click',()=>{modal.close()},{once:true});
  modal.querySelector('[data-modal-delete]').addEventListener('click',()=>{modal.removeEventListener('close',onClose);modal.close();resolve(true)},{once:true});
  if(!modal.open)modal.showModal();
 });
}
function startDuplicateTransaction(id){const item=allTransactions.find(x=>x.id===id);if(!item)return;editingTransactionId=null;$('type').value=item.transaction_type;renderCategoryOptions();$('category').value=item.category;$('amount').value=item.amount;$('date').value=localDate(new Date());$('description').value=item.description||'';$('transactionForm').querySelector('button[type="submit"]').textContent='＋ រក្សាទុកប្រតិបត្តិការថ្មី';$('cancelEditBtn').classList.remove('hidden');setMessage('formMessage','បានចម្លងព័ត៌មានរួចរាល់។ សូមពិនិត្យព័ត៌មាន មុនចុចរក្សាទុក។');openTransactionModal('ចម្លងប្រតិបត្តិការ');$('amount').focus()}
function startEditTransaction(id){const item=allTransactions.find(x=>x.id===id);if(!item)return;editingTransactionId=id;$('type').value=item.transaction_type;renderCategoryOptions();$('category').value=item.category;$('amount').value=item.amount;$('date').value=item.transaction_date||localDate(new Date());$('description').value=item.description||'';$('transactionForm').querySelector('button[type="submit"]').textContent='រក្សាទុកការកែប្រែ';$('cancelEditBtn').classList.remove('hidden');setMessage('formMessage','កំពុងកែប្រែប្រតិបត្តិការ...');openTransactionModal('កែប្រែប្រតិបត្តិការ')}
function resetTransactionForm(){editingTransactionId=null;$('transactionForm').reset();$('date').value=localDate(new Date());renderCategoryOptions();$('transactionForm').querySelector('button[type="submit"]').textContent='＋ រក្សាទុកទិន្នន័យ';$('cancelEditBtn').classList.add('hidden');setMessage('formMessage','')}
['transactionSearch','transactionTypeFilter','transactionCategoryFilter','dateFromFilter','dateToFilter'].forEach(id=>$(id).addEventListener(id==='transactionSearch'?'input':'change',()=>{if(id==='transactionTypeFilter')renderCategoryOptions();transactionPage=1;renderDashboard()}));
$('transactionPagination').addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(!button||button.disabled)return;transactionPage=Number(button.dataset.page)||1;renderDashboard()});
$('transactionRows').addEventListener('click',async e=>{const duplicate=e.target.closest('[data-duplicate]');if(duplicate){startDuplicateTransaction(duplicate.dataset.duplicate);return}const edit=e.target.closest('[data-edit]');if(edit){startEditTransaction(edit.dataset.edit);return}const b=e.target.closest('[data-delete]');if(!b)return;const item=allTransactions.find(x=>x.id===b.dataset.delete);if(!item)return;if(!await showDeleteConfirmation(item))return;try{const {error}=await db.from('transactions').delete().eq('id',item.id);if(error){showToast('មិនអាចលុបប្រតិបត្តិការបានទេ៖ '+error.message,true);return}showToast('បានលុបប្រតិបត្តិការដោយជោគជ័យ។');await loadTransactions()}catch(error){showToast('មានបញ្ហាក្នុងការលុបប្រតិបត្តិការ។',true)}});
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
if(db){
 // Supabase emits INITIAL_SESSION after restoring the persisted session.
 // Defer UI/data work out of the auth callback to avoid holding the auth lock.
 db.auth.onAuthStateChange((event,session)=>{
  if(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='SIGNED_OUT'){
   setTimeout(()=>{
    document.documentElement.classList.remove('auth-initializing');
    if(session){void showApp().catch(error=>{console.error('Family Finance startup failed:',error);showToast('មិនអាចផ្ទុកទិន្នន័យបានទេ។ សូមពិនិត្យការតភ្ជាប់។',true)})}
    else if(event==='INITIAL_SESSION'||event==='SIGNED_OUT'){showLogin()}
   },0);
  }
 });
}else{
 document.documentElement.classList.remove('auth-initializing');
}


// Backup & Restore: browser-side JSON export/import for authenticated family data.
const BACKUP_VERSION = 1;
const BACKUP_TABLES = {
 family_members: ['id','name','relationship','created_at'],
 categories: ['id','transaction_type','name','created_at'],
 savings_goals: ['id','title','target_amount','saved_amount','currency','target_date','created_at'],
 app_settings: ['id','setting_key','setting_value','updated_at'],
 transactions: ['id','transaction_type','amount','currency','category','description','transaction_date','member_id','created_at']
};
let selectedBackupPayload = null;

async function readAllBackupRows(table){
 const pageSize=500, rows=[];
 for(let offset=0;;offset+=pageSize){
  const {data,error}=await db.from(table).select('*').order('id',{ascending:true}).range(offset,offset+pageSize-1);
  if(error)throw new Error(table+': '+error.message);
  rows.push(...(data||[]));
  if(!data||data.length<pageSize)break;
 }
 return rows;
}
async function createBackupPayload(){
 const tables={};
 for(const table of Object.keys(BACKUP_TABLES))tables[table]=await readAllBackupRows(table);
 return {
  app:'Family Finance',
  format:'family-finance-backup',
  version:BACKUP_VERSION,
  exported_at:new Date().toISOString(),
  tables
 };
}
function downloadBackupPayload(payload,prefix='Family-Finance-Backup'){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 const stamp=localDate(new Date())+'-'+new Date().toTimeString().slice(0,8).replace(/:/g,'');
 link.href=url;link.download=prefix+'-'+stamp+'.json';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function exportFullBackup(){
 if(!db){setMessage('backupMessage','សូមចូលគណនីគ្រួសារជាមុនសិន។',true);return}
 const button=$('backupNowBtn');button.disabled=true;setMessage('backupMessage','កំពុងប្រមូលទិន្នន័យគ្រួសារ...');
 try{
  const payload=await createBackupPayload();
  downloadBackupPayload(payload);
  const total=Object.values(payload.tables).reduce((sum,rows)=>sum+rows.length,0);
  setMessage('backupMessage','Backup បានជោគជ័យ! រក្សាទុក '+total+' កំណត់ត្រា ក្នុងឯកសារ JSON។');
 }catch(error){setMessage('backupMessage','Backup មិនបានជោគជ័យ៖ '+error.message,true)}
 finally{button.disabled=false}
}
function validateBackupPayload(payload){
 if(!payload||payload.format!=='family-finance-backup'||payload.app!=='Family Finance'||payload.version!==BACKUP_VERSION||!payload.tables||typeof payload.tables!=='object')throw new Error('ឯកសារនេះមិនមែនជា Family Finance Backup version ដែលគាំទ្រទេ។');
 for(const table of Object.keys(BACKUP_TABLES)){
  if(!Array.isArray(payload.tables[table]))throw new Error('ឯកសារមិនមានបញ្ជីទិន្នន័យ '+table+' ត្រឹមត្រូវទេ។');
  const fields=BACKUP_TABLES[table];
  payload.tables[table].forEach((row,index)=>{
   if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('ទិន្នន័យ '+table+' លេខ '+(index+1)+' មិនត្រឹមត្រូវទេ។');
   if(!row.id)throw new Error('ទិន្នន័យ '+table+' លេខ '+(index+1)+' ខ្វះ ID។');
   for(const key of Object.keys(row))if(!fields.includes(key))throw new Error('ឯកសារមានវាលមិនស្គាល់ ('+table+'.'+key+')។');
  });
 }
}
function showBackupPreview(payload,fileName){
 const counts=Object.entries(BACKUP_TABLES).map(([table])=>'<li><span>'+escapeHtml(table)+'</span><strong>'+payload.tables[table].length+'</strong></li>').join('');
 $('restorePreview').innerHTML='<strong>ឯកសារ៖ '+escapeHtml(fileName)+'</strong><ul>'+counts+'</ul><p>បង្កើតនៅ៖ '+escapeHtml(payload.exported_at||'មិនបានបញ្ជាក់')+'</p><p class="muted">ទិន្នន័យនឹងត្រូវ Merge/Update តាម ID។ ទិន្នន័យបច្ចុប្បន្នដែលមិនមានក្នុងឯកសារនេះនឹងមិនត្រូវបានលុបទេ។</p>';
 $('restorePreview').classList.remove('hidden');
 $('restoreNowBtn').classList.remove('hidden');$('restoreNowBtn').disabled=false;
}
async function handleBackupFileChange(event){
 selectedBackupPayload=null;$('restoreNowBtn').disabled=true;$('restoreNowBtn').classList.add('hidden');$('restorePreview').classList.add('hidden');
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>25*1024*1024){setMessage('backupMessage','ឯកសារធំពេក (កំណត់អតិបរមា 25 MB)។',true);return}
 try{
  const payload=JSON.parse(await file.text());
  validateBackupPayload(payload);
  selectedBackupPayload=payload;showBackupPreview(payload,file.name);
  setMessage('backupMessage','បានអានឯកសារ Backup ដោយជោគជ័យ។ សូមពិនិត្យចំនួនទិន្នន័យមុន Restore។');
 }catch(error){setMessage('backupMessage','មិនអាចប្រើឯកសារនេះបានទេ៖ '+error.message,true)}
}
function backupRowsForRestore(table,rows){
 const fields=BACKUP_TABLES[table];
 return rows.map(row=>Object.fromEntries(fields.filter(key=>Object.prototype.hasOwnProperty.call(row,key)).map(key=>[key,row[key]])));
}
async function upsertBackupTable(table,rows){
 const batchSize=200;
 const conflict={
  family_members:'id',
  categories:'transaction_type,name',
  savings_goals:'id',
  app_settings:'setting_key',
  transactions:'id'
 }[table];
 for(let i=0;i<rows.length;i+=batchSize){
  const batch=backupRowsForRestore(table,rows.slice(i,i+batchSize));
  const {error}=await db.from(table).upsert(batch,{onConflict:conflict});
  if(error)throw new Error(table+': '+error.message);
 }
}
async function restoreBackup(){
 if(!db||!selectedBackupPayload)return;
 validateBackupPayload(selectedBackupPayload);
 const total=Object.values(selectedBackupPayload.tables).reduce((sum,rows)=>sum+rows.length,0);
 if(!confirm('តើអ្នកប្រាកដថាចង់ Restore '+total+' កំណត់ត្រាមែនទេ? ប្រព័ន្ធនឹងទាញយក Backup ទិន្នន័យបច្ចុប្បន្នជាមុន។'))return;
 const button=$('restoreNowBtn');button.disabled=true;$('backupNowBtn').disabled=true;
 try{
  setMessage('backupMessage','កំពុងបង្កើត Backup ទិន្នន័យបច្ចុប្បន្ន មុន Restore...');
  const safetyCopy=await createBackupPayload();
  downloadBackupPayload(safetyCopy,'Family-Finance-Before-Restore');
  const order=['family_members','categories','savings_goals','app_settings','transactions'];
  for(const table of order){
   setMessage('backupMessage','កំពុង Restore '+table+'...');
   await upsertBackupTable(table,selectedBackupPayload.tables[table]);
  }
  await loadCategories();await loadTransactions();
  setMessage('backupMessage','Restore បានជោគជ័យ! បានបញ្ចូល/ធ្វើបច្ចុប្បន្នភាព '+total+' កំណត់ត្រា។ សូមពិនិត្យទិន្នន័យក្នុង Dashboard។');
 }catch(error){
  setMessage('backupMessage','Restore មិនបានបញ្ចប់ទេ៖ '+error.message+'។ ទិន្នន័យដែលបានអនុវត្តមុនកំហុសអាចនៅមាន។ សូមពិនិត្យ ហើយសាកល្បងម្ដងទៀត។',true);
 }finally{$('backupNowBtn').disabled=false;button.disabled=false}
}
$('backupNowBtn').addEventListener('click',exportFullBackup);
$('restoreFile').addEventListener('change',handleBackupFileChange);
$('restoreNowBtn').addEventListener('click',restoreBackup);
