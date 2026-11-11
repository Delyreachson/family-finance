// Family Finance - Supabase connection settings
const SUPABASE_URL = 'https://ludrupofaaeqmqzvhvox.supabase.co';
// IMPORTANT: paste the same sb_publishable_ key from your currently working app.js here.
// Never use a service_role or secret key in a browser app.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wk15NsgFvDCkZbUuHVeyWg_YEHveiFp';
const $ = (id) => document.getElementById(id);
const KEY_PLACEHOLDER = 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE';
const configured = SUPABASE_PUBLISHABLE_KEY !== KEY_PLACEHOLDER && SUPABASE_PUBLISHABLE_KEY.length > 20;
let db = null, chart = null, allTransactions = [], allCategories = [], categoryChannel = null, editingTransactionId = null;
if (configured && window.supabase?.createClient) db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const money = (v) => new Intl.NumberFormat('km-KH',{maximumFractionDigits:0}).format(Number(v)||0)+' ៛';
const setMessage=(id,msg,error=false)=>{const el=$(id);el.textContent=msg;el.classList.toggle('error',error)};
const today = new Date(); $('date').value = localDate(today);
$('monthFilter').value = today.toISOString().slice(0,7);
if(!configured) $('setupNotice').classList.remove('hidden');
function localDate(d){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return setMessage('loginMessage','សូមបញ្ចូល Publishable Key ក្នុង app.js ជាមុនសិន។',true);setMessage('loginMessage','កំពុងពិនិត្យគណនី...');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)return setMessage('loginMessage',error.message,true);await showApp()});
$('logoutBtn').addEventListener('click',async()=>{if(db)await db.auth.signOut();showLogin()});
$('refreshBtn').addEventListener('click',async()=>{await loadCategories();await loadTransactions()});$('monthFilter').addEventListener('change',renderDashboard);$('type').addEventListener('change',renderCategoryOptions);$('manageCategoriesBtn').addEventListener('click',()=>{$('categoryManager').scrollIntoView?.({behavior:'smooth'});$('categoryManager')?.classList.toggle('category-highlight')});$('addCategoryBtn').addEventListener('click',addCategory);$('categoryRows').addEventListener('click',handleCategoryAction);
$('transactionForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return;setMessage('formMessage','កំពុងរក្សាទុក...');const payload={transaction_type:$('type').value,amount:Number($('amount').value),currency:'KHR',category:$('category').value.trim(),description:$('description').value.trim()||null,transaction_date:$('date').value};const query=editingTransactionId?db.from('transactions').update(payload).eq('id',editingTransactionId):db.from('transactions').insert(payload);const {error}=await query;if(error)return setMessage('formMessage',error.message,true);resetTransactionForm();setMessage('formMessage',editingTransactionId?'បានកែប្រែប្រតិបត្តិការដោយជោគជ័យ។':'បានរក្សាទុកទិន្នន័យដោយជោគជ័យ។');editingTransactionId=null;await loadTransactions()});
$('cancelEditBtn').addEventListener('click',resetTransactionForm);
async function showApp(){$('loginPanel').classList.add('hidden');$('appPanel').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');await loadCategories();await loadTransactions();subscribeCategories()}
function showLogin(){if(categoryChannel&&db){db.removeChannel(categoryChannel);categoryChannel=null}$('appPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden');$('logoutBtn').classList.add('hidden')}

async function loadCategories(){
 if(!db)return;
 const {data,error}=await db.from('categories').select('id,transaction_type,name').order('name',{ascending:true});
 if(error){setMessage('categoryMessage','មិនអាចផ្ទុកប្រភេទបាន៖ '+error.message,true);return}
 allCategories=data||[];renderCategoryOptions();renderCategoryRows();
}
function renderCategoryOptions(){
 const type=$('type').value;const current=$('category').value;
 const options=allCategories.filter(c=>c.transaction_type===type);
 $('category').innerHTML='<option value="">ជ្រើសរើសប្រភេទ</option>'+options.map(c=>'<option value="'+escapeHtml(c.name)+'">'+escapeHtml(c.name)+'</option>').join('');
 if(options.some(c=>c.name===current))$('category').value=current;
}
function renderCategoryRows(){
 const rows=allCategories;
 if(!rows.length){$('categoryRows').innerHTML='<span class="muted">មិនទាន់មានប្រភេទទេ។ សូមចុច បន្ថែមប្រភេទ។</span>';return}
 $('categoryRows').innerHTML=['income','expense'].map(type=>{
 const title=type==='income'?'ចំណូល':'ចំណាយ';
 const items=rows.filter(c=>c.transaction_type===type);
 return '<div class="category-group"><strong>'+title+'</strong><div class="category-chips">'+(items.length?items.map(c=>'<span class="category-chip">'+escapeHtml(c.name)+' <button type="button" data-edit-category="'+c.id+'" aria-label="កែឈ្មោះ">កែ</button><button type="button" data-delete-category="'+c.id+'" aria-label="លុប">លុប</button></span>').join(''):'<span class="muted">មិនទាន់មាន</span>')+'</div></div>';
 }).join('');
}
async function addCategory(){
 const type=prompt('ជ្រើសប្រភេទ៖ វាយ income សម្រាប់ចំណូល ឬ expense សម្រាប់ចំណាយ','expense');
 if(type===null)return;
 const normalized=type.trim().toLowerCase();
 if(!['income','expense'].includes(normalized)){setMessage('categoryMessage','សូមវាយ income ឬ expense។',true);return}
 const name=prompt('បញ្ចូលឈ្មោះប្រភេទថ្មី៖');if(name===null)return;
 const clean=name.trim();if(!clean)return;
 const {error}=await db.from('categories').insert({transaction_type:normalized,name:clean});
 if(error){setMessage('categoryMessage',error.code==='23505'?'ប្រភេទនេះមានរួចហើយ។':error.message,true);return}
 setMessage('categoryMessage','បានបន្ថែមប្រភេទថ្មីដោយជោគជ័យ។');await loadCategories();
}
async function handleCategoryAction(e){
 const edit=e.target.closest('[data-edit-category]');const del=e.target.closest('[data-delete-category]');
 if(edit){
  const item=allCategories.find(c=>c.id===edit.dataset.editCategory);if(!item)return;
  const name=prompt('កែឈ្មោះប្រភេទ៖',item.name);if(name===null)return;const clean=name.trim();if(!clean)return;
  const {error}=await db.from('categories').update({name:clean}).eq('id',item.id);
  if(error){setMessage('categoryMessage',error.message,true);return}
  setMessage('categoryMessage','បានកែឈ្មោះប្រភេទ។');await loadCategories();
 }
 if(del){
  const item=allCategories.find(c=>c.id===del.dataset.deleteCategory);if(!item)return;
  const {count,error:checkError}=await db.from('transactions').select('id',{count:'exact',head:true}).eq('transaction_type',item.transaction_type).eq('category',item.name);
  if(checkError){setMessage('categoryMessage',checkError.message,true);return}
  if(count>0){setMessage('categoryMessage','មិនអាចលុបបានទេ ព្រោះប្រភេទនេះមានក្នុងប្រវត្តិប្រតិបត្តិការ។',true);return}
  if(!confirm('តើអ្នកចង់លុបប្រភេទ «'+item.name+'» មែនទេ?'))return;
  const {error}=await db.from('categories').delete().eq('id',item.id);
  if(error){setMessage('categoryMessage',error.message,true);return}
  setMessage('categoryMessage','បានលុបប្រភេទ។');await loadCategories();
 }
}
function subscribeCategories(){
 if(!db||categoryChannel)return;
 categoryChannel=db.channel('family-finance-categories').on('postgres_changes',{event:'*',schema:'public',table:'categories'},()=>loadCategories()).subscribe();
}

async function loadTransactions(){if(!db)return;const {data,error}=await db.from('transactions').select('id,transaction_type,amount,currency,category,description,transaction_date').order('transaction_date',{ascending:false});if(error){$('transactionRows').innerHTML=`<tr><td colspan="4" class="empty">${escapeHtml(error.message)}</td></tr>`;return}allTransactions=data||[];renderDashboard()}
function renderDashboard(){const month=$('monthFilter').value;const rows=allTransactions.filter(x=>!month||(x.transaction_date||'').startsWith(month));const income=rows.filter(x=>x.transaction_type==='income').reduce((s,x)=>s+Number(x.amount),0);const expense=rows.filter(x=>x.transaction_type==='expense').reduce((s,x)=>s+Number(x.amount),0);$('incomeTotal').textContent=money(income);$('expenseTotal').textContent=money(expense);$('balanceTotal').textContent=money(income-expense);$('monthIncome').textContent=money(income);$('monthExpense').textContent=money(expense);$('monthBalance').textContent=money(income-expense);$('recordCount').textContent=rows.length+' ប្រតិបត្តិការ';renderChart(rows);renderRows(rows)}
function renderChart(rows){if(!window.Chart)return;const grouped={};rows.forEach(x=>{const d=x.transaction_date||'';const key=d.slice(0,10);if(!grouped[key])grouped[key]={income:0,expense:0};grouped[key][x.transaction_type==='income'?'income':'expense']+=Number(x.amount)||0});const labels=Object.keys(grouped).sort();const income=labels.map(k=>grouped[k].income),expense=labels.map(k=>grouped[k].expense);if(chart)chart.destroy();chart=new Chart($('financeChart'),{type:'bar',data:{labels,datasets:[{label:'ចំណូល',data:income,backgroundColor:'#159574',borderRadius:6},{label:'ចំណាយ',data:expense,backgroundColor:'#e47768',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.dataset.label+': '+money(c.raw)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>new Intl.NumberFormat('km-KH',{notation:'compact'}).format(v)}}}}})}
function renderRows(rows){if(!rows.length){$('transactionRows').innerHTML='<tr><td colspan="4" class="empty">មិនទាន់មានទិន្នន័យក្នុងខែនេះ</td></tr>';return}$('transactionRows').innerHTML=rows.slice(0,100).map(x=>`<tr><td>${escapeHtml(x.transaction_date||'')}</td><td><strong>${escapeHtml(x.category)}</strong><br><span class="muted">${escapeHtml(x.description||(x.transaction_type==='income'?'ចំណូល':'ចំណាយ'))}</span></td><td class="${x.transaction_type==='income'?'amount-in':'amount-out'}">${x.transaction_type==='income'?'+':'−'}${money(x.amount)}</td><td><button class="edit" data-edit="${x.id}" aria-label="កែប្រែ">កែ</button> <button class="delete" data-delete="${x.id}" aria-label="លុប">លុប</button></td></tr>`).join('')}
function startEditTransaction(id){const item=allTransactions.find(x=>x.id===id);if(!item)return;editingTransactionId=id;$('type').value=item.transaction_type;renderCategoryOptions();$('category').value=item.category;$('amount').value=item.amount;$('date').value=item.transaction_date||localDate(new Date());$('description').value=item.description||'';$('transactionForm').querySelector('button[type="submit"]').textContent='រក្សាទុកការកែប្រែ';$('cancelEditBtn').classList.remove('hidden');setMessage('formMessage','កំពុងកែប្រែប្រតិបត្តិការ...');$('transactionForm').scrollIntoView({behavior:'smooth',block:'center'})}
function resetTransactionForm(){editingTransactionId=null;$('transactionForm').reset();$('date').value=localDate(new Date());renderCategoryOptions();$('transactionForm').querySelector('button[type="submit"]').textContent='＋ រក្សាទុកទិន្នន័យ';$('cancelEditBtn').classList.add('hidden');setMessage('formMessage','')}
$('transactionRows').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit]');if(edit){startEditTransaction(edit.dataset.edit);return}const b=e.target.closest('[data-delete]');if(!b||!confirm('តើអ្នកប្រាកដថាចង់លុបទិន្នន័យនេះមែនទេ?'))return;const {error}=await db.from('transactions').delete().eq('id',b.dataset.delete);if(error)alert(error.message);else await loadTransactions()});
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
if(db){db.auth.getSession().then(({data})=>{if(data.session)showApp()});db.auth.onAuthStateChange((_event,session)=>{if(session)showApp();else showLogin()})}
