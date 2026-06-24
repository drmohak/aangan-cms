const { createApp } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// ================================================================
//  SHARED HELPERS
// ================================================================

function todayIso() { return new Date().toISOString().split('T')[0]; }

function fmtDateShort(iso) {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dueDateStatus(dueDate) {
  if (!dueDate) return 'unknown';
  const today = todayIso();
  if (dueDate < today)  return 'overdue';
  if (dueDate === today) return 'today';
  return 'upcoming';
}

function fcDotClass(fc) {
  if (fc.status === 'completed' || fc.status === 'declined') return 'fc-dot fc-dot-completed';
  const s = dueDateStatus(fc.dueDate);
  if (s === 'overdue') return 'fc-dot fc-dot-overdue';
  const map = { anc: 'fc-dot-anc', vaccination: 'fc-dot-vaccination', post_procedure: 'fc-dot-post', annual_recall: 'fc-dot-recall' };
  return 'fc-dot ' + (map[fc.followupType] || 'fc-dot-anc');
}

function fcBadge(fc) {
  if (fc.status === 'completed') return { text: 'Completed', cls: 'fc-badge-completed' };
  if (fc.status === 'declined')  return { text: 'Declined',  cls: 'fc-badge-completed' };
  const s = dueDateStatus(fc.dueDate);
  if (s === 'overdue')  return { text: 'Overdue',  cls: 'fc-badge-overdue' };
  if (s === 'today')    return { text: 'Due today', cls: 'fc-badge-today' };
  return { text: fmtDateShort(fc.dueDate), cls: 'fc-badge-upcoming' };
}

// ================================================================
//  LOGIN SCREEN
// ================================================================

const Login = {
  name: 'Login',
  props: ['whitelistError'],
  data() { return { signing: false, error: null }; },
  methods: {
    async signIn() {
      this.signing = true; this.error = null;
      try {
        await signInWithGoogle();
      } catch (e) {
        if (e.code !== 'auth/popup-closed-by-user') this.error = 'Sign-in failed. Please try again.';
        this.signing = false;
      }
    }
  },
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo-mark">AC</div>
          <div>
            <div class="login-clinic-name">Aangan Clinic</div>
            <div class="login-clinic-sub">Women\u2019s health centre</div>
          </div>
        </div>
        <div class="login-divider"></div>
        <p class="login-tagline">Staff portal &mdash; sign in to continue</p>
        <button class="google-btn" @click="signIn" :disabled="signing">
          <svg v-if="!signing" width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          <i class="ti ti-loader spin" v-else></i>
          {{ signing ? 'Signing in\u2026' : 'Sign in with Google' }}
        </button>
        <p class="login-error" v-if="whitelistError">Your account is not authorised. Contact the clinic administrator.</p>
        <p class="login-error" v-else-if="error">{{ error }}</p>
      </div>
    </div>
  `
};

// ================================================================
//  PATIENT SCREENS  (Steps 3–4)
// ================================================================

const PatientSearch = {
  name: 'PatientSearch',
  data() { return { query: '', allPatients: [], loading: true, loadError: null, filter: 'all' }; },
  computed: {
    filteredPatients() {
      let pts = this.allPatients;
      if (this.filter === 'adults')   pts = pts.filter(p => p.type !== 'child');
      if (this.filter === 'children') pts = pts.filter(p => p.type === 'child');
      if (!this.query.trim()) return pts;
      const q = this.query.toLowerCase();
      return pts.filter(p =>
        (p.name||'').toLowerCase().includes(q) || (p.mobile||'').includes(q) || (p.patientId||'').toLowerCase().includes(q)
      );
    }
  },
  methods: {
    async loadPatients() {
      this.loading = true; this.loadError = null;
      try { this.allPatients = await getAllPatients(); }
      catch (e) { this.loadError = 'Could not load patients.'; }
      finally { this.loading = false; }
    },
    initials(n)    { return patientInitials(n); },
    avatarClass(n) { return patientAvatarClass(n); },
    age(d)         { const a = calcAge(d); return a !== null ? a + ' yrs' : null; },
    clearSearch()  { this.query = ''; }
  },
  mounted() { this.loadPatients(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i> Dashboard</button><span class="sep">/</span><span class="current">Patients</span></div></div>
        <div class="topbar-right"><button class="btn btn-primary" @click="$router.push('/patients/new')"><i class="ti ti-user-plus"></i> New patient</button></div>
      </div>
      <div class="content">
        <div class="search-wrap">
          <i class="ti ti-search"></i>
          <input type="text" v-model="query" class="search-input" placeholder="Search by name, mobile, or patient ID\u2026" />
          <button class="search-clear" v-if="query" @click="clearSearch"><i class="ti ti-x"></i></button>
        </div>
        <div class="filter-bar">
          <button class="filter-btn" :class="{on:filter==='all'}"      @click="filter='all'">All</button>
          <button class="filter-btn" :class="{on:filter==='adults'}"   @click="filter='adults'">Adults</button>
          <button class="filter-btn" :class="{on:filter==='children'}" @click="filter='children'">Children</button>
        </div>
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="empty-section" v-else-if="loadError"><i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p></div>
        <div class="empty-section" v-else-if="allPatients.length===0">
          <i class="ti ti-users"></i><p>No patients registered yet</p>
          <button class="btn btn-primary" style="margin-top:14px" @click="$router.push('/patients/new')"><i class="ti ti-user-plus"></i> Register first patient</button>
        </div>
        <template v-else>
          <p class="results-meta" v-if="query">{{ filteredPatients.length }} result{{ filteredPatients.length===1?'':'s' }} for &ldquo;{{ query }}&rdquo;</p>
          <p class="results-meta" v-else>{{ filteredPatients.length }} patient{{ filteredPatients.length===1?'':'s' }}</p>
          <div class="empty-section" v-if="filteredPatients.length===0"><i class="ti ti-zoom-cancel"></i><p>No patients match &ldquo;{{ query }}&rdquo;</p></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th style="width:36px"></th>
                <th>Name</th><th>ID</th><th>Age</th><th>Mobile</th><th>Type</th><th style="width:40px"></th>
              </tr></thead>
              <tbody>
                <tr class="trow" v-for="p in filteredPatients" :key="p.id" @click="$router.push('/patients/'+p.id)">
                  <td><div class="avatar avatar-sm" :class="p.type==='child'?'avatar-blue':avatarClass(p.name)">{{ initials(p.name) }}</div></td>
                  <td class="td-name">{{ p.name }}</td>
                  <td class="td-mono">{{ p.patientId }}</td>
                  <td class="td-muted">{{ age(p.dob)||'—' }}</td>
                  <td class="td-muted">{{ p.mobile||p.motherName||'—' }}</td>
                  <td><span class="pill pill-blue" v-if="p.type==='child'">Child</span><span class="pill pill-teal" v-else>Adult</span></td>
                  <td><i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:13px"></i></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  `
};

const NewPatient = {
  name: 'NewPatient',
  data() { return { form: { name:'', mobile:'', dob:'', bloodGroup:'', address:'', husbandName:'', waConsent:true }, saving:false, errors:{} }; },
  methods: {
    validate() {
      this.errors={};
      if (!this.form.name.trim()) this.errors.name='Patient name is required';
      if (!this.form.mobile.trim()) this.errors.mobile='Mobile number is required';
      else if (!/^\d{10}$/.test(this.form.mobile.trim())) this.errors.mobile='Enter a valid 10-digit mobile number';
      return !Object.keys(this.errors).length;
    },
    async save() {
      if (!this.validate()) return;
      this.saving=true;
      try { const p=await createPatient(this.form); this.$router.push('/patients/'+p.id); }
      catch(e) { alert('Error saving patient.'); }
      finally { this.saving=false; }
    }
  },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="$router.push('/patients')"><i class="ti ti-arrow-left"></i> Patients</button><span class="sep">/</span><span class="current">New patient</span></div></div>
      </div>
      <div class="content">
        <div class="form-card">
          <div class="form-card-title">Register new patient</div>
          <p class="form-section-title">Patient information</p>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Name <span class="form-required">*</span></label><input type="text" v-model="form.name" class="form-input" :class="{'input-error':errors.name}" placeholder="Full name" /><p class="form-error" v-if="errors.name">{{ errors.name }}</p></div>
            <div class="form-group"><label class="form-label">Mobile <span class="form-required">*</span></label><input type="tel" v-model="form.mobile" class="form-input" :class="{'input-error':errors.mobile}" placeholder="10-digit mobile" maxlength="10" /><p class="form-error" v-if="errors.mobile">{{ errors.mobile }}</p></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Date of birth</label><input type="date" v-model="form.dob" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Blood group</label><select v-model="form.bloodGroup" class="form-select"><option value="">Select</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div>
          </div>
          <p class="form-section-title">Additional information</p>
          <div class="form-group"><label class="form-label">Husband&rsquo;s name</label><input type="text" v-model="form.husbandName" class="form-input" placeholder="Optional" /></div>
          <div class="form-group"><label class="form-label">Address</label><textarea v-model="form.address" class="form-input" rows="2" style="resize:vertical"></textarea></div>
          <p class="form-section-title">WhatsApp</p>
          <label class="checkbox-label"><input type="checkbox" v-model="form.waConsent" /> Patient has consented to receive WhatsApp messages from the clinic</label>
          <div class="form-actions">
            <button class="btn btn-primary" @click="save" :disabled="saving"><i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-check" v-else></i> {{ saving?'Saving\u2026':'Save patient' }}</button>
            <button class="btn btn-secondary" @click="$router.push('/patients')" :disabled="saving">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};

const PatientEdit = {
  name: 'PatientEdit',
  data() { return { form:{name:'',mobile:'',dob:'',bloodGroup:'',address:'',husbandName:'',waConsent:false}, saving:false, loading:true, errors:{} }; },
  methods: {
    async loadPatient() {
      this.loading=true;
      try { const p=await getPatient(this.$route.params.id); if(p) this.form={name:p.name||'',mobile:p.mobile||'',dob:p.dob||'',bloodGroup:p.bloodGroup||'',address:p.address||'',husbandName:p.husbandName||'',waConsent:!!p.waConsent}; }
      finally { this.loading=false; }
    },
    validate() {
      this.errors={};
      if (!this.form.name.trim()) this.errors.name='Patient name is required';
      if (!this.form.mobile.trim()) this.errors.mobile='Mobile number is required';
      else if (!/^\d{10}$/.test(this.form.mobile.trim())) this.errors.mobile='Enter a valid 10-digit mobile number';
      return !Object.keys(this.errors).length;
    },
    async save() {
      if (!this.validate()) return;
      this.saving=true;
      try { await updatePatient(this.$route.params.id,this.form); this.$router.push('/patients/'+this.$route.params.id); }
      catch(e) { alert('Error saving.'); }
      finally { this.saving=false; }
    }
  },
  mounted() { this.loadPatient(); },
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="$router.push('/patients/'+$route.params.id)"><i class="ti ti-arrow-left"></i> Patient</button><span class="sep">/</span><span class="current">Edit</span></div></div></div>
      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="form-card" v-else>
          <div class="form-card-title">Edit patient</div>
          <p class="form-section-title">Patient information</p>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Name <span class="form-required">*</span></label><input type="text" v-model="form.name" class="form-input" :class="{'input-error':errors.name}" /><p class="form-error" v-if="errors.name">{{ errors.name }}</p></div>
            <div class="form-group"><label class="form-label">Mobile <span class="form-required">*</span></label><input type="tel" v-model="form.mobile" class="form-input" :class="{'input-error':errors.mobile}" maxlength="10" /><p class="form-error" v-if="errors.mobile">{{ errors.mobile }}</p></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Date of birth</label><input type="date" v-model="form.dob" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Blood group</label><select v-model="form.bloodGroup" class="form-select"><option value="">Select</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div>
          </div>
          <p class="form-section-title">Additional information</p>
          <div class="form-group"><label class="form-label">Husband&rsquo;s name</label><input type="text" v-model="form.husbandName" class="form-input" /></div>
          <div class="form-group"><label class="form-label">Address</label><textarea v-model="form.address" class="form-input" rows="2" style="resize:vertical"></textarea></div>
          <p class="form-section-title">WhatsApp</p>
          <label class="checkbox-label"><input type="checkbox" v-model="form.waConsent" /> Patient has consented to receive WhatsApp messages from the clinic</label>
          <div class="form-actions">
            <button class="btn btn-primary" @click="save" :disabled="saving"><i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-check" v-else></i> {{ saving?'Saving\u2026':'Save changes' }}</button>
            <button class="btn btn-secondary" @click="$router.push('/patients/'+$route.params.id)" :disabled="saving">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};

const ChildRegistration = {
  name: 'ChildRegistration',
  data() { return { mother:null, loadingMother:true, form:{name:'',dob:'',gender:'',birthWeight:''}, saving:false, errors:{} }; },
  methods: {
    async loadMother() {
      this.loadingMother=true;
      try { this.mother=await getPatient(this.$route.params.id); if(this.mother&&!this.form.name) this.form.name='Baby of '+this.mother.name; }
      finally { this.loadingMother=false; }
    },
    validate() {
      this.errors={};
      if (!this.form.name.trim()) this.errors.name='Child name is required';
      if (!this.form.dob) this.errors.dob='Date of birth is required to generate vaccination schedule';
      return !Object.keys(this.errors).length;
    },
    async save() {
      if (!this.validate()) return;
      this.saving=true;
      try { await createChild(this.$route.params.id,this.form,this.mother); this.$router.push('/patients/'+this.$route.params.id); }
      catch(e) { alert('Error saving.'); }
      finally { this.saving=false; }
    }
  },
  mounted() { this.loadMother(); },
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="$router.push('/patients/'+$route.params.id)"><i class="ti ti-arrow-left"></i> {{ mother?mother.name:'Patient' }}</button><span class="sep">/</span><span class="current">Register child</span></div></div></div>
      <div class="content">
        <div class="loading-wrap" v-if="loadingMother"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="form-card" v-else>
          <div class="form-card-title">Register child</div>
          <div class="mother-context" v-if="mother"><i class="ti ti-user"></i> Mother: <strong>{{ mother.name }}</strong> &middot; {{ mother.patientId }}</div>
          <p class="form-section-title">Child information</p>
          <div class="form-group"><label class="form-label">Child\u2019s name <span class="form-required">*</span></label><input type="text" v-model="form.name" class="form-input" :class="{'input-error':errors.name}" /><p class="form-error" v-if="errors.name">{{ errors.name }}</p></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Date of birth <span class="form-required">*</span></label><input type="date" v-model="form.dob" class="form-input" :class="{'input-error':errors.dob}" /><p class="form-error" v-if="errors.dob">{{ errors.dob }}</p><p style="font-size:11px;color:var(--text-muted);margin-top:4px">Needed for vaccination schedule</p></div>
            <div class="form-group"><label class="form-label">Gender</label><select v-model="form.gender" class="form-select"><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></div>
          </div>
          <div class="form-group"><label class="form-label">Birth weight (kg)</label><input type="number" v-model="form.birthWeight" class="form-input" placeholder="e.g. 3.2" step="0.01" min="0.5" max="6" /></div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="save" :disabled="saving"><i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-check" v-else></i> {{ saving?'Saving\u2026':'Register child' }}</button>
            <button class="btn btn-secondary" @click="$router.push('/patients/'+$route.params.id)" :disabled="saving">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};

// ================================================================
//  PATIENT PROFILE  (Step 3+4+5: shows follow-up cases)
// ================================================================

const PatientProfile = {
  name: 'PatientProfile',
  data() { return { patient:null, loading:true, loadError:null, children:[], mother:null, followups:[], encounters:[], showAllFollowups:false, showDeleteModal:false, deleteReason:'', deleteConfirmName:'', deleting:false, linkedCount:null }; },
  computed: {
    isChild()     { return this.patient&&this.patient.type==='child'; },
    initials()    { return this.patient?patientInitials(this.patient.name):'?'; },
    avatarClass() { if(!this.patient) return 'avatar-teal'; return this.isChild?'avatar-blue':patientAvatarClass(this.patient.name); },
    ageLabel() {
      if (!this.patient||!this.patient.dob) return '\u2014';
      const today=new Date(),birth=new Date(this.patient.dob);
      let yrs=today.getFullYear()-birth.getFullYear();
      const m=today.getMonth()-birth.getMonth();
      if(m<0||(m===0&&today.getDate()<birth.getDate())) yrs--;
      if(yrs<2){ let months=(today.getFullYear()-birth.getFullYear())*12+today.getMonth()-birth.getMonth(); if(today.getDate()<birth.getDate()) months--; return months<1?'Newborn':months+(months===1?' month':' months'); }
      return yrs+' yrs';
    },
    dobLabel() { return this.patient?formatDateIn(this.patient.dob):'\u2014'; },
    activeFollowups() { return this.followups.filter(f=>f.status==='active'); },
    visibleFollowups() { return this.showAllFollowups?this.activeFollowups:this.activeFollowups.slice(0,4); },
    waHref() {
      if(!this.patient||!this.patient.waConsent||!this.patient.mobile) return null;
      const name=this.isChild?(this.patient.motherName||this.patient.name):this.patient.name;
      const child=this.isChild?' regarding '+this.patient.name+'\u2019s vaccination':'';
      return waLink(this.patient.mobile,name,'Dear '+name+',\n\nThis is a reminder from Aangan Clinic'+child+'.\n\nPlease contact us if you have any questions.\n\nAangan Clinic');
    }
  },
  methods: {
    async loadPatient() {
      this.loading=true; this.loadError=null; this.patient=null; this.children=[]; this.mother=null; this.followups=[];
      try {
        this.patient=await getPatient(this.$route.params.id);
        if(!this.patient){ this.loadError='Patient record not found.'; return; }
        const [children,mother,followups]=await Promise.all([
          !this.isChild?getChildrenByMother(this.patient.id):Promise.resolve([]),
          (this.isChild&&this.patient.motherId)?getPatient(this.patient.motherId):Promise.resolve(null),
          getPatientFollowups(this.patient.id)
        ]);
        this.children=children; this.mother=mother; this.followups=followups;
      } catch(e) { this.loadError='Could not load patient.'; }
      finally { this.loading=false; }
    },
    newFollowupUrl() {
      const base='/followups/new?patientId='+this.patient.id;
      return this.isChild?base+'&type=vaccination':base;
    },
    fcDot(fc)   { return fcDotClass(fc); },
    fcBadge(fc) { return fcBadge(fc); },
    fmtDate(d)  { return fmtDateShort(d); },
    childAge(dob) {
      if(!dob) return null;
      const today=new Date(),birth=new Date(dob);
      let yrs=today.getFullYear()-birth.getFullYear();
      const m=today.getMonth()-birth.getMonth();
      if(m<0||(m===0&&today.getDate()<birth.getDate())) yrs--;
      if(yrs<2){ let months=(today.getFullYear()-birth.getFullYear())*12+today.getMonth()-birth.getMonth(); if(today.getDate()<birth.getDate()) months--; return months<1?'Newborn':months+' mo'; }
      return yrs+' yrs';
    },
    ci(n)  { return patientInitials(n); },
    ca(n)  { return patientAvatarClass(n); },
    fmtEncDate(d) { return fmtDateShort(d); },
    isSuperUser() { return this.$root.role === 'superuser'; },
    async loadLinkedCount() {
      const [fup, inv, enc, ch] = await Promise.all([
        db.collection('followupCases').where('patientDocId','==',this.patient.id).get(),
        db.collection('invoices').where('patientId','==',this.patient.id).get(),
        db.collection('encounters').where('patientDocId','==',this.patient.id).get(),
        db.collection('patients').where('motherId','==',this.patient.id).get()
      ]);
      this.linkedCount = { followups:fup.size, invoices:inv.size, encounters:enc.size, children:ch.size, total:fup.size+inv.size+enc.size+ch.size };
    },
    async confirmDelete() {
      this.deleting = true;
      try {
        const user = this.$root.user;
        await hardDeletePatient(this.patient, this.deleteReason, user ? user.email : 'unknown');
        this.showDeleteModal = false;
        this.$router.push('/patients');
      } catch(e) { alert('Error: ' + e.message); }
      finally { this.deleting = false; }
    }
  },
  mounted() { this.loadPatient(); },
  watch: { '$route.params.id'() { this.loadPatient(); } },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="$router.push('/patients')"><i class="ti ti-arrow-left"></i> Patients</button>
            <span class="sep">/</span>
            <span class="current">{{ loading?'Loading\u2026':(patient?patient.name:'Not found') }}</span>
          </div>
        </div>
        <div class="topbar-right" v-if="patient">
          <button class="btn btn-secondary btn-sm" @click="$router.push('/encounters/new')"><i class="ti ti-notes"></i> New encounter</button>
          <button class="btn btn-primary btn-sm" @click="$router.push(newFollowupUrl())"><i class="ti ti-calendar-plus"></i> New follow-up</button>
        </div>
      </div>
      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading patient\u2026</div>
        <div class="empty-section" v-else-if="loadError"><i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p><button class="btn btn-secondary" style="margin-top:14px" @click="$router.push('/patients')">Back to patients</button></div>
        <template v-else-if="patient">
          <div class="profile-header">
            <div class="avatar avatar-lg" :class="avatarClass">{{ initials }}</div>
            <div style="flex:1;min-width:0">
              <div class="profile-name">{{ patient.name }}</div>
              <div class="profile-sub">{{ patient.patientId }} &middot; {{ ageLabel }}<template v-if="patient.mobile"> &middot; {{ patient.mobile }}</template></div>
              <div class="profile-sub" v-if="!isChild&&patient.husbandName">Husband: {{ patient.husbandName }}</div>
              <div class="profile-tags">
                <span class="pill pill-blue" v-if="isChild">Child</span><span class="pill pill-gray" v-else>Adult</span>
                <span class="pill pill-pink" v-if="patient.gender==='female'">Female</span>
                <span class="pill pill-sky"  v-if="patient.gender==='male'">Male</span>
                <span class="pill pill-teal" v-if="patient.waConsent"><i class="ti ti-brand-whatsapp" style="font-size:10px"></i> WA consent</span>
                <span class="pill pill-gray" v-else style="opacity:.6">No WA consent</span>
              </div>
            </div>
            <div class="profile-actions">
              <a v-if="waHref" :href="waHref" target="_blank" class="btn btn-secondary btn-sm"><i class="ti ti-brand-whatsapp" style="color:var(--teal-mid)"></i> WhatsApp</a>
              <button v-else class="btn btn-secondary btn-sm" style="opacity:.45" disabled><i class="ti ti-brand-whatsapp"></i> WhatsApp</button>
              <button class="btn btn-secondary btn-sm" @click="$router.push('/patients/'+patient.id+'/edit')"><i class="ti ti-edit"></i> Edit</button>
            </div>
          </div>

          <div class="info-card" v-if="!isChild&&(patient.dob||patient.bloodGroup||patient.address)">
            <div class="info-grid">
              <div class="info-item" v-if="patient.dob"><div class="info-label">Date of birth</div><div class="info-value">{{ dobLabel }}</div></div>
              <div class="info-item" v-if="patient.bloodGroup"><div class="info-label">Blood group</div><div class="info-value">{{ patient.bloodGroup }}</div></div>
              <div class="info-item info-full" v-if="patient.address"><div class="info-label">Address</div><div class="info-value">{{ patient.address }}</div></div>
            </div>
          </div>

          <div class="info-card" v-if="isChild&&(patient.dob||patient.gender||patient.birthWeight)">
            <div class="info-grid">
              <div class="info-item" v-if="patient.dob"><div class="info-label">Date of birth</div><div class="info-value">{{ dobLabel }}</div></div>
              <div class="info-item" v-if="patient.gender"><div class="info-label">Gender</div><div class="info-value" style="text-transform:capitalize">{{ patient.gender }}</div></div>
              <div class="info-item" v-if="patient.birthWeight"><div class="info-label">Birth weight</div><div class="info-value">{{ patient.birthWeight }} kg</div></div>
            </div>
          </div>

          <template v-if="isChild">
            <div class="section-header"><div class="section-title"><i class="ti ti-user" style="color:var(--teal-mid)"></i> Mother</div></div>
            <div class="mother-link-card" v-if="mother" @click="$router.push('/patients/'+mother.id)">
              <div class="avatar avatar-md" :class="ca(mother.name)">{{ ci(mother.name) }}</div>
              <div style="flex:1"><div class="mother-link-label">Mother\u2019s record</div><div class="mother-link-name">{{ mother.name }} &middot; {{ mother.patientId }}</div></div>
              <i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:15px"></i>
            </div>
          </template>

          <template v-if="!isChild">
            <div class="section-header">
              <div class="section-title"><i class="ti ti-heart" style="color:var(--teal-mid)"></i> Children</div>
              <button class="btn btn-primary btn-sm" @click="$router.push('/patients/'+patient.id+'/child')"><i class="ti ti-plus"></i> Register child</button>
            </div>
            <div class="section-card" style="margin-bottom:16px">
              <template v-if="children.length>0">
                <div class="child-card" v-for="c in children" :key="c.id" @click="$router.push('/patients/'+c.id)">
                  <div class="avatar avatar-sm avatar-blue">{{ ci(c.name) }}</div>
                  <div style="flex:1"><div class="child-name">{{ c.name }}</div><div class="child-meta">{{ c.patientId }}<template v-if="childAge(c.dob)"> &middot; {{ childAge(c.dob) }}</template><template v-if="c.gender"> &middot; <span style="text-transform:capitalize">{{ c.gender }}</span></template></div></div>
                  <i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:14px"></i>
                </div>
              </template>
              <div class="empty-section" style="padding:20px" v-else><i class="ti ti-heart"></i><p>No children registered</p></div>
            </div>
          </template>

          <div class="section-header">
            <div class="section-title">
              <i class="ti ti-calendar-check" style="color:var(--teal-mid)"></i>
              {{ isChild?'Vaccination schedule':'Active follow-up cases' }}
              <span class="pill pill-teal" v-if="activeFollowups.length" style="margin-left:6px;font-size:10px">{{ activeFollowups.length }}</span>
            </div>
            <button class="btn btn-primary btn-sm" @click="$router.push(newFollowupUrl())"><i class="ti ti-plus"></i> New</button>
          </div>
          <div class="section-card" style="margin-bottom:16px">
            <template v-if="activeFollowups.length>0">
              <div class="followup-case-card" v-for="fc in visibleFollowups" :key="fc.id" @click="$router.push('/followups/'+fc.id)">
                <div :class="fcDot(fc)"></div>
                <div class="fc-info">
                  <div class="fc-subtype">{{ fc.subType }}</div>
                  <div class="fc-meta">{{ fc.ageAtDose||fc.weekNumber&&('Week '+fc.weekNumber)||fc.procedureType||fc.recallType||'' }}</div>
                </div>
                <span class="fc-badge" :class="fcBadge(fc).cls">{{ fcBadge(fc).text }}</span>
                <i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:14px;flex-shrink:0"></i>
              </div>
              <div style="padding:8px 14px;border-top:1px solid var(--border)" v-if="activeFollowups.length>4">
                <button style="background:none;border:none;font-size:12px;color:var(--teal-mid);cursor:pointer" @click="showAllFollowups=!showAllFollowups">
                  {{ showAllFollowups?'Show less':('Show all '+activeFollowups.length+' cases') }}
                </button>
              </div>
            </template>
            <div class="empty-section" style="padding:22px" v-else>
              <i class="ti ti-calendar"></i>
              <p>No active follow-up cases</p>
            </div>
          </div>

          <div class="section-header">
            <div class="section-title"><i class="ti ti-stethoscope" style="color:var(--teal-mid)"></i> Recent encounters</div>
            <button class="btn btn-primary btn-sm" @click="$router.push('/encounters/new?patientId='+patient.id)"><i class="ti ti-plus"></i> New</button>
          </div>
          <div class="section-card">
            <template v-if="encounters.length>0">
              <div class="encounter-row" v-for="e in encounters.slice(0,5)" :key="e.id">
                <div class="encounter-icon"><i class="ti ti-stethoscope"></i></div>
                <div class="encounter-info">
                  <div class="encounter-doctor">{{ e.doctorName }} &middot; {{ fmtEncDate(e.date) }}</div>
                  <div class="encounter-diagnosis" v-if="e.diagnosis">{{ e.diagnosis }}</div>
                  <div class="encounter-meta" v-if="e.notes">{{ e.notes }}</div>
                  <div class="encounter-meta" v-if="e.completedFollowupIds&&e.completedFollowupIds.length">
                    <i class="ti ti-check" style="color:var(--teal-mid)"></i>
                    {{ e.completedFollowupIds.length }} follow-up{{ e.completedFollowupIds.length===1?'':'s' }} closed
                  </div>
                </div>
              </div>
              <div class="row-more" v-if="encounters.length>5" style="font-size:12px;color:var(--text-muted)">
                + {{ encounters.length-5 }} more encounters
              </div>
            </template>
            <div class="empty-section" style="padding:22px" v-else>
              <i class="ti ti-notes"></i><p>No encounters recorded yet</p>
            </div>
          </div>
        </template>

        <!-- Superuser: delete patient -->
        <div class="dz-strip" v-if="isSuperUser() && !loading && patient">
          <button class="dz-delete-btn" @click="loadLinkedCount(); showDeleteModal = true">
            <i class="ti ti-trash"></i> Delete patient permanently
          </button>
          <span class="dz-note">Superuser — cascades to all linked records</span>
        </div>

      </div>
    </div>

    <!-- Delete modal -->
    <div class="modal-overlay" v-if="showDeleteModal" @click.self="showDeleteModal = false">
      <div class="modal-box">
        <div class="modal-title"><i class="ti ti-trash" style="color:#dc2626"></i> Delete patient permanently</div>
        <div class="modal-body">All records for <strong>{{ patient ? patient.name : '' }}</strong> will be permanently erased.</div>
        <div class="modal-warn" v-if="linkedCount && linkedCount.total > 0">
          Will also delete: {{ linkedCount.followups }} follow-up{{ linkedCount.followups===1?'':'s' }},
          {{ linkedCount.invoices }} invoice{{ linkedCount.invoices===1?'':'s' }},
          {{ linkedCount.encounters }} encounter{{ linkedCount.encounters===1?'':'s' }},
          {{ linkedCount.children }} child record{{ linkedCount.children===1?'':'s' }}
          — <strong>{{ linkedCount.total }} records total.</strong>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Reason <span class="form-required">*</span></label>
          <input type="text" v-model="deleteReason" class="form-input" placeholder="Why is this record being deleted?" />
        </div>
        <div class="form-group">
          <label class="form-label">Type the patient name to confirm: <strong>{{ patient ? patient.name : '' }}</strong></label>
          <input type="text" v-model="deleteConfirmName" class="form-input" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showDeleteModal = false">Cancel</button>
          <button class="btn" style="background:#dc2626;color:white;border-color:#dc2626"
            :disabled="deleting || !deleteReason.trim() || deleteConfirmName.trim().toLowerCase() !== (patient ? patient.name.toLowerCase() : 'x')"
            @click="confirmDelete()">{{ deleting ? 'Deleting…' : 'Delete permanently' }}</button>
        </div>
      </div>
    </div>

  `
};


// ================================================================
//  STEP 5: FOLLOW-UP CREATION
// ================================================================

const FollowupCreation = {
  name: 'FollowupCreation',
  data() {
    return {
      patient: null, loadingPatient: false,
      patientQuery: '', patientResults: [], searchingPatients: false,
      followupType: null,
      hasExistingAnc: false, hasExistingVaccination: false,
      form: { lmp:'', procedureType:'', reviewDays:'7', customDate:'', recallType:'', recallDate:'', notes:'' },
      saving: false, errors: {}
    };
  },
  computed: {
    edd() { return this.form.lmp?addDays(this.form.lmp,280):null; },
    ancPreview() {
      if (!this.form.lmp) return [];
      const today=todayIso();
      return ANC_WEEKS.map(w=>({ weeks:w, date:addWeeks(this.form.lmp,w), past:addWeeks(this.form.lmp,w)<today }));
    },
    vaccineGroups() {
      if (!this.patient||!this.patient.dob) return [];
      return groupVaccinesByAge(IAP_VACCINES,this.patient.dob);
    },
    vaccineCount() { return IAP_VACCINES.length; },
    postProcedureDueDate() {
      if (this.form.reviewDays==='custom') return this.form.customDate;
      return addDays(todayIso(),parseInt(this.form.reviewDays));
    },
    availableTypes() {
      if (!this.patient) return [];
      if (this.patient.type==='child') return ['vaccination'];
      return ['anc','post_procedure','annual_recall'];
    }
  },
  methods: {
    async loadPatient(id) {
      this.loadingPatient=true;
      try {
        this.patient=await getPatient(id);
        if (this.patient) {
          if (this.patient.type==='child') this.followupType='vaccination';
          const [anc,vax]=await Promise.all([
            hasFollowupsOfType(this.patient.id,'anc'),
            hasFollowupsOfType(this.patient.id,'vaccination')
          ]);
          this.hasExistingAnc=anc; this.hasExistingVaccination=vax;
        }
      } finally { this.loadingPatient=false; }
    },
    async searchPatients() {
      if (!this.patientQuery.trim()) { this.patientResults=[]; return; }
      this.searchingPatients=true;
      try {
        const all=await getAllPatients();
        const q=this.patientQuery.toLowerCase();
        this.patientResults=all.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.mobile||'').includes(q)||(p.patientId||'').toLowerCase().includes(q)).slice(0,5);
      } finally { this.searchingPatients=false; }
    },
    selectPatient(p) {
      this.patient=p; this.patientQuery=''; this.patientResults=[];
      if (p.type==='child') this.followupType='vaccination';
    },
    validate() {
      this.errors={};
      if (!this.patient) { this.errors.patient='Please select a patient'; return false; }
      if (!this.followupType) { this.errors.type='Please select a follow-up type'; return false; }
      if (this.followupType==='anc'&&!this.form.lmp) this.errors.lmp='LMP date is required';
      if (this.followupType==='post_procedure'&&!this.form.procedureType) this.errors.procedureType='Procedure type is required';
      if (this.followupType==='annual_recall') {
        if (!this.form.recallType) this.errors.recallType='Recall type is required';
        if (!this.form.recallDate) this.errors.recallDate='Recall date is required';
      }
      return !Object.keys(this.errors).length;
    },
    async save() {
      if (!this.validate()) return;
      this.saving=true;
      try {
        if (this.followupType==='anc') {
          await createAncFollowups(this.patient,this.form.lmp);
        } else if (this.followupType==='vaccination') {
          await createVaccinationFollowups(this.patient,this.patient.dob);
        } else if (this.followupType==='post_procedure') {
          await createPostProcedureFollowup(this.patient,{ procedureType:this.form.procedureType, dueDate:this.postProcedureDueDate, notes:this.form.notes });
        } else if (this.followupType==='annual_recall') {
          await createAnnualRecallFollowup(this.patient,{ recallType:this.form.recallType, dueDate:this.form.recallDate, notes:this.form.notes });
        }
        this.$router.push('/patients/'+this.patient.id);
      } catch(e) { alert('Error creating follow-up. Please try again.'); }
      finally { this.saving=false; }
    },
    initials(n) { return patientInitials(n); },
    avatarClass(n) { return patientAvatarClass(n); },
    fmtDate(d) { return fmtDateShort(d); }
  },
  mounted() {
    if (this.$route.query.patientId) this.loadPatient(this.$route.query.patientId);
    if (this.$route.query.type)      this.followupType=this.$route.query.type;
  },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="patient?$router.push('/patients/'+patient.id):$router.push('/patients')"><i class="ti ti-arrow-left"></i> {{ patient?patient.name:'Patients' }}</button>
            <span class="sep">/</span><span class="current">New follow-up</span>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="form-card" style="max-width:640px">

          <div class="form-card-title">Create follow-up case</div>

          <div class="loading-wrap" v-if="loadingPatient" style="padding:20px"><i class="ti ti-loader spin"></i> Loading patient\u2026</div>

          <template v-else>
            <p class="form-section-title">Patient</p>
            <div class="patient-banner" v-if="patient">
              <div class="avatar avatar-md" :class="patient.type==='child'?'avatar-blue':avatarClass(patient.name)">{{ initials(patient.name) }}</div>
              <div>
                <div class="patient-banner-name">{{ patient.name }}</div>
                <div class="patient-banner-id">{{ patient.patientId }}<template v-if="patient.type==='child'"> &middot; Child &middot; DOB: {{ fmtDate(patient.dob) }}</template></div>
              </div>
              <button class="btn btn-secondary btn-sm" style="margin-left:auto" @click="patient=null;followupType=null">Change</button>
            </div>
            <div v-else>
              <div class="search-wrap">
                <i class="ti ti-search"></i>
                <input type="text" v-model="patientQuery" class="search-input" placeholder="Search patient by name or mobile\u2026" @input="searchPatients" />
              </div>
              <div class="section-card" v-if="patientResults.length">
                <div class="patient-search-result" v-for="p in patientResults" :key="p.id" @click="selectPatient(p)">
                  <div class="avatar avatar-sm" :class="p.type==='child'?'avatar-blue':avatarClass(p.name)">{{ initials(p.name) }}</div>
                  <div><div style="font-size:13px;font-weight:500">{{ p.name }}</div><div style="font-size:11px;color:var(--text-muted)">{{ p.patientId }} &middot; {{ p.mobile||p.motherName }}</div></div>
                </div>
              </div>
              <p class="form-error" v-if="errors.patient">{{ errors.patient }}</p>
            </div>

            <template v-if="patient">
              <p class="form-section-title" style="margin-top:20px">Follow-up type</p>
              <div class="type-grid">
                <button class="type-btn" :class="{on:followupType==='anc', disabled:patient.type==='child'}" @click="followupType='anc'" v-if="patient.type!=='child'">
                  <i class="ti ti-heart-rate-monitor"></i> ANC visit
                  <span v-if="hasExistingAnc" style="font-size:10px;color:var(--amber-mid)">(existing)</span>
                </button>
                <button class="type-btn" :class="{on:followupType==='vaccination', disabled:patient.type!=='child'&&patient.type==='adult'}" @click="followupType='vaccination'" v-if="patient.type==='child'||true">
                  <i class="ti ti-vaccine"></i> Vaccination
                  <span v-if="hasExistingVaccination" style="font-size:10px;color:var(--amber-mid)">(existing)</span>
                </button>
                <button class="type-btn" :class="{on:followupType==='post_procedure'}" @click="followupType='post_procedure'" v-if="patient.type!=='child'">
                  <i class="ti ti-surgical-tape"></i> Post-procedure
                </button>
                <button class="type-btn" :class="{on:followupType==='annual_recall'}" @click="followupType='annual_recall'" v-if="patient.type!=='child'">
                  <i class="ti ti-calendar-repeat"></i> Annual recall
                </button>
              </div>
              <p class="form-error" v-if="errors.type">{{ errors.type }}</p>

              <template v-if="followupType==='anc'">
                <p class="form-section-title">ANC details</p>
                <div class="form-group">
                  <label class="form-label">LMP date <span class="form-required">*</span></label>
                  <input type="date" v-model="form.lmp" class="form-input" :class="{'input-error':errors.lmp}" />
                  <p class="form-error" v-if="errors.lmp">{{ errors.lmp }}</p>
                </div>
                <div class="edd-display" v-if="edd"><i class="ti ti-baby-carriage"></i> EDD: {{ fmtDate(edd) }}</div>
                <div v-if="ancPreview.length">
                  <p style="font-size:12px;font-weight:500;color:var(--text-secondary);margin-bottom:6px">{{ ancPreview.length }} visits will be created:</p>
                  <div class="anc-preview">
                    <div class="anc-row" v-for="v in ancPreview" :key="v.weeks" :class="{past:v.past}">
                      <span class="week-label">Week {{ v.weeks }}</span>
                      <span class="due-date">{{ fmtDate(v.date) }}</span>
                      <span class="pill pill-gray" v-if="v.past" style="font-size:10px">Past</span>
                    </div>
                  </div>
                </div>
              </template>

              <template v-if="followupType==='vaccination'">
                <p class="form-section-title">Vaccination schedule</p>
                <div v-if="patient.dob">
                  <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">{{ vaccineCount }} vaccines will be scheduled from DOB {{ fmtDate(patient.dob) }}:</p>
                  <div class="vaccine-age-group" v-for="g in vaccineGroups" :key="g.ageLabel">
                    <div class="vaccine-age-label">{{ g.ageLabel }}</div>
                    <div class="vaccine-age-date">{{ fmtDate(g.dueDate) }}</div>
                    <div class="vaccine-row" v-for="v in g.vaccines" :key="v.code">
                      <i class="ti ti-circle-check"></i> {{ v.name }} (Dose {{ v.doseNumber }})
                    </div>
                  </div>
                </div>
                <div class="empty-section" v-else style="padding:16px">
                  <i class="ti ti-alert-triangle"></i>
                  <p>Child\u2019s date of birth is missing. Please update the child\u2019s profile first.</p>
                </div>
              </template>

              <template v-if="followupType==='post_procedure'">
                <p class="form-section-title">Post-procedure details</p>
                <div class="form-group">
                  <label class="form-label">Procedure type <span class="form-required">*</span></label>
                  <select v-model="form.procedureType" class="form-select" :class="{'input-error':errors.procedureType}">
                    <option value="">Select procedure</option>
                    <option>LSCS</option>
                    <option>Normal delivery</option>
                    <option>D&amp;C</option>
                    <option>Hysterectomy</option>
                    <option>Infertility procedure</option>
                    <option>Other gynaecological procedure</option>
                  </select>
                  <p class="form-error" v-if="errors.procedureType">{{ errors.procedureType }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Review after</label>
                  <div class="filter-bar" style="margin-bottom:0">
                    <button class="filter-btn" :class="{on:form.reviewDays==='3'}"   @click="form.reviewDays='3'">3 days</button>
                    <button class="filter-btn" :class="{on:form.reviewDays==='7'}"   @click="form.reviewDays='7'">7 days</button>
                    <button class="filter-btn" :class="{on:form.reviewDays==='14'}"  @click="form.reviewDays='14'">14 days</button>
                    <button class="filter-btn" :class="{on:form.reviewDays==='30'}"  @click="form.reviewDays='30'">30 days</button>
                    <button class="filter-btn" :class="{on:form.reviewDays==='custom'}" @click="form.reviewDays='custom'">Custom</button>
                  </div>
                  <input type="date" v-if="form.reviewDays==='custom'" v-model="form.customDate" class="form-input" style="margin-top:8px" />
                </div>
                <div class="edd-display" v-if="postProcedureDueDate"><i class="ti ti-calendar"></i> Due: {{ fmtDate(postProcedureDueDate) }}</div>
                <div class="form-group">
                  <label class="form-label">Notes</label>
                  <textarea v-model="form.notes" class="form-input" rows="2" placeholder="Optional"></textarea>
                </div>
              </template>

              <template v-if="followupType==='annual_recall'">
                <p class="form-section-title">Annual recall details</p>
                <div class="form-group">
                  <label class="form-label">Recall type <span class="form-required">*</span></label>
                  <select v-model="form.recallType" class="form-select" :class="{'input-error':errors.recallType}">
                    <option value="">Select type</option>
                    <option>Pap smear</option>
                    <option>Annual gynaecology review</option>
                    <option>Menopause review</option>
                    <option>Other</option>
                  </select>
                  <p class="form-error" v-if="errors.recallType">{{ errors.recallType }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Due date <span class="form-required">*</span></label>
                  <input type="date" v-model="form.recallDate" class="form-input" :class="{'input-error':errors.recallDate}" />
                  <p class="form-error" v-if="errors.recallDate">{{ errors.recallDate }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Notes</label>
                  <textarea v-model="form.notes" class="form-input" rows="2" placeholder="Optional"></textarea>
                </div>
              </template>

              <div class="form-actions" v-if="followupType">
                <button class="btn btn-primary" @click="save" :disabled="saving||(followupType==='vaccination'&&!patient.dob)">
                  <i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-check" v-else></i>
                  {{ saving?'Creating\u2026':'Create follow-up' }}
                </button>
                <button class="btn btn-secondary" @click="$router.go(-1)" :disabled="saving">Cancel</button>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>
  `
};

// ================================================================
//  STEPS 8 & 9: FOLLOW-UP DETAIL  (reminders + contact log)
// ================================================================

const FollowupDetail = {
  name: 'FollowupDetail',
  data() {
    return {
      fc: null, loading: true, loadError: null,
      updating: false, patient: null,
      reminders: [], loadingReminders: false,
      contactLogs: [], loadingLogs: false,
      showLogForm: false,
      logForm: { outcome: '', notes: '' },
      savingLog: false
    };
  },
  computed: {
    typeIcon() {
      const m = { anc:'ti-heart-rate-monitor', vaccination:'ti-vaccine', post_procedure:'ti-surgical-tape', annual_recall:'ti-calendar-repeat' };
      return this.fc ? 'ti ' + (m[this.fc.followupType] || 'ti-calendar-check') : '';
    },
    typeCls() {
      const m = { anc:'detail-type-anc', vaccination:'detail-type-vaccination', post_procedure:'detail-type-post', annual_recall:'detail-type-recall' };
      return this.fc ? 'detail-type-icon ' + (m[this.fc.followupType] || 'detail-type-anc') : 'detail-type-icon';
    },
    badge()              { return this.fc ? fcBadge(this.fc) : { text:'', cls:'' }; },
    fmtDue()             { return this.fc ? fmtDateShort(this.fc.dueDate) : '\u2014'; },
    today()              { return todayIso(); },
    actionableReminders(){ return this.reminders.filter(r => r.status === 'pending' && r.reminderDate <= this.today); },
    hasReminders()       { return this.reminders.length > 0; },
    outcomeOptions()     { return CONTACT_OUTCOMES; }
  },
  methods: {
    async load() {
      this.loading = true; this.loadError = null;
      try {
        this.fc = await getFollowupCase(this.$route.params.id);
        if (!this.fc) { this.loadError = 'Follow-up case not found.'; return; }
        this.patient = await getPatient(this.fc.patientDocId);
        await Promise.all([ this.loadReminders(), this.loadContactLogs() ]);
      } catch(e) { this.loadError = 'Could not load follow-up.'; }
      finally { this.loading = false; }
    },
    async loadReminders() {
      this.loadingReminders = true;
      try { this.reminders = await getReminderTasksForCase(this.fc.id); }
      finally { this.loadingReminders = false; }
    },
    async loadContactLogs() {
      this.loadingLogs = true;
      try { this.contactLogs = await getContactLogs(this.fc.id); }
      finally { this.loadingLogs = false; }
    },
    async markStatus(status) {
      this.updating = true;
      try {
        if (status === 'completed') {
          await completeFollowupCase(this.fc.id);
          this.fc.status = 'completed';
          this.reminders = this.reminders.map(r => ({ ...r, status: 'skipped' }));
        } else {
          await updateFollowupStatus(this.fc.id, status);
          this.fc.status = status;
        }
      } catch(e) { alert('Error updating status.'); }
      finally { this.updating = false; }
    },
    async markReminderSent(taskId) {
      try {
        await updateReminderStatus(taskId, 'sent');
        const t = this.reminders.find(r => r.id === taskId);
        if (t) t.status = 'sent';
      } catch(e) { alert('Error.'); }
    },
    async markReminderSkipped(taskId) {
      try {
        await updateReminderStatus(taskId, 'skipped');
        const t = this.reminders.find(r => r.id === taskId);
        if (t) t.status = 'skipped';
      } catch(e) { alert('Error.'); }
    },
    async generateMissingReminders() {
      if (!this.fc || !this.patient) return;
      try { await generateRemindersForCase(this.fc, this.patient); await this.loadReminders(); }
      catch(e) { alert('Error generating reminders.'); }
    },
    async saveContactLog() {
      if (!this.logForm.outcome) return;
      this.savingLog = true;
      try {
        await logContactOutcome(
          this.fc.id, this.fc.patientDocId, this.fc.patientName,
          this.logForm.outcome, this.logForm.notes
        );
        this.logForm = { outcome: '', notes: '' };
        this.showLogForm = false;
        await this.loadContactLogs();
      } catch(e) { alert('Error saving.'); }
      finally { this.savingLog = false; }
    },
    waLink(r)           { return buildReminderWaLink(r); },
    fmtDate(d)          { return fmtDateShort(d); },
    outcomeLabel(v)     { const o = CONTACT_OUTCOMES.find(x => x.value === v); return o ? o.label : v; },
    outcomePill(v)      { return OUTCOME_PILL[v] || 'pill-gray'; },
    fmtTs(ts) {
      if (!ts) return '\u2014';
      const d = ts.toDate ? ts.toDate() : new Date((ts.seconds || 0) * 1000);
      return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' }) +
        ' at ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    },
    reminderDotCls(r) {
      if (r.status === 'sent')    return 'r-dot r-dot-sent';
      if (r.status === 'skipped') return 'r-dot r-dot-skipped';
      if (r.reminderDate < this.today) return 'r-dot r-dot-overdue';
      if (r.reminderDate === this.today) return 'r-dot r-dot-today';
      return 'r-dot r-dot-pending';
    },
    reminderLabel(r) {
      if (r.daysBeforeDue === 1) return '1 day before';
      return r.daysBeforeDue + ' days before';
    }
  },
  mounted() { this.load(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="fc?$router.push('/patients/'+fc.patientDocId):$router.go(-1)">
              <i class="ti ti-arrow-left"></i> {{ fc?fc.patientName:'Back' }}
            </button>
            <span class="sep">/</span><span class="current">Follow-up</span>
          </div>
        </div>
        <div class="topbar-right" v-if="fc&&fc.status==='active'">
          <button class="btn btn-secondary btn-sm" @click="$router.push('/encounters/new?patientId='+fc.patientDocId)">
            <i class="ti ti-stethoscope"></i> Record visit
          </button>
        </div>
      </div>

      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="empty-section" v-else-if="loadError"><i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p></div>

        <template v-else-if="fc">
          <div class="detail-card">
            <div class="detail-type-header">
              <div :class="typeCls"><i :class="typeIcon"></i></div>
              <div>
                <div class="detail-subtype">{{ fc.subType }}</div>
                <div class="detail-patient">{{ fc.patientName }} &middot; {{ fc.patientId }}</div>
              </div>
              <span class="fc-badge" :class="badge.cls" style="margin-left:auto">{{ badge.text }}</span>
            </div>
            <div class="info-grid">
              <div class="info-item"><div class="info-label">Due date</div><div class="info-value">{{ fmtDue }}</div></div>
              <div class="info-item"><div class="info-label">Status</div><div class="info-value" style="text-transform:capitalize">{{ fc.status }}</div></div>
              <div class="info-item" v-if="fc.lmp"><div class="info-label">LMP</div><div class="info-value">{{ fc.lmp }}</div></div>
              <div class="info-item" v-if="fc.edd"><div class="info-label">EDD</div><div class="info-value">{{ fc.edd }}</div></div>
              <div class="info-item" v-if="fc.ageAtDose"><div class="info-label">Age at dose</div><div class="info-value">{{ fc.ageAtDose }}</div></div>
              <div class="info-item" v-if="fc.procedureType"><div class="info-label">Procedure</div><div class="info-value">{{ fc.procedureType }}</div></div>
              <div class="info-item info-full" v-if="fc.notes"><div class="info-label">Notes</div><div class="info-value">{{ fc.notes }}</div></div>
            </div>
          </div>

          <div class="form-actions" v-if="fc.status==='active'" style="margin-bottom:20px">
            <button class="btn btn-primary" @click="markStatus('completed')" :disabled="updating">
              <i class="ti ti-loader spin" v-if="updating"></i><i class="ti ti-check" v-else></i> Mark completed
            </button>
            <button class="btn btn-secondary" @click="markStatus('declined')" :disabled="updating">Mark declined</button>
          </div>

          <!-- Reminder tasks -->
          <div class="section-header">
            <div class="section-title">
              <i class="ti ti-brand-whatsapp" style="color:var(--teal-mid)"></i> Reminder tasks
              <span class="pill pill-amber" v-if="actionableReminders.length" style="margin-left:6px;font-size:10px">{{ actionableReminders.length }} due</span>
            </div>
            <button class="btn btn-secondary btn-sm" v-if="!hasReminders&&!loadingReminders" @click="generateMissingReminders">
              <i class="ti ti-refresh"></i> Generate
            </button>
          </div>
          <div class="section-card" style="margin-bottom:16px">
            <div class="loading-wrap" v-if="loadingReminders" style="padding:16px"><i class="ti ti-loader spin"></i></div>
            <template v-else-if="hasReminders">
              <div class="reminder-row" v-for="r in reminders" :key="r.id">
                <div :class="reminderDotCls(r)"></div>
                <div class="reminder-info">
                  <div class="reminder-date">{{ fmtDate(r.reminderDate) }}</div>
                  <div class="reminder-meta">{{ reminderLabel(r) }}</div>
                </div>
                <span class="pill pill-teal"  v-if="r.status==='sent'">Sent</span>
                <span class="pill pill-gray"  v-else-if="r.status==='skipped'">Skipped</span>
                <span class="pill pill-gray"  v-else-if="r.reminderDate>today" style="opacity:.6">Upcoming</span>
                <template v-else>
                  <a v-if="waLink(r)" :href="waLink(r)" target="_blank" class="action-btn action-btn-wa"><i class="ti ti-brand-whatsapp"></i> Send</a>
                  <span v-else class="pill pill-gray" style="font-size:10px">No WA</span>
                  <button class="action-btn action-btn-call" @click="markReminderSent(r.id)"><i class="ti ti-check"></i> Sent</button>
                  <button class="action-btn" style="border-color:var(--border-mid);color:var(--text-muted)" @click="markReminderSkipped(r.id)">Skip</button>
                </template>
              </div>
            </template>
            <div class="empty-section" style="padding:20px" v-else>
              <i class="ti ti-bell-off"></i><p>No reminder tasks</p>
              <p style="font-size:11px;color:#ccc;margin-top:2px">Click Generate above to create them.</p>
            </div>
          </div>

          <!-- Contact history (Step 8) -->
          <div class="section-header">
            <div class="section-title">
              <i class="ti ti-history" style="color:var(--teal-mid)"></i> Contact history
              <span class="pill pill-gray" v-if="contactLogs.length" style="margin-left:6px;font-size:10px">{{ contactLogs.length }}</span>
            </div>
            <button class="btn btn-secondary btn-sm" v-if="!showLogForm" @click="showLogForm=true">
              <i class="ti ti-plus"></i> Log contact
            </button>
          </div>

          <div class="detail-card" v-if="showLogForm" style="margin-bottom:10px">
            <div class="form-group">
              <label class="form-label">Outcome <span class="form-required">*</span></label>
              <select v-model="logForm.outcome" class="form-select">
                <option value="">Select outcome</option>
                <option v-for="o in outcomeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea v-model="logForm.notes" class="form-input" rows="2" placeholder="Optional"></textarea>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px">
              <button class="btn btn-primary btn-sm" @click="saveContactLog" :disabled="!logForm.outcome||savingLog">
                <i class="ti ti-loader spin" v-if="savingLog"></i><i class="ti ti-check" v-else></i>
                {{ savingLog ? 'Saving\u2026' : 'Save' }}
              </button>
              <button class="btn btn-secondary btn-sm" @click="showLogForm=false;logForm={outcome:'',notes:''}">Cancel</button>
            </div>
          </div>

          <div class="section-card">
            <div class="loading-wrap" v-if="loadingLogs" style="padding:16px"><i class="ti ti-loader spin"></i></div>
            <template v-else-if="contactLogs.length">
              <div class="contact-log-row" v-for="log in contactLogs" :key="log.id">
                <div class="contact-log-header">
                  <span class="pill" :class="outcomePill(log.outcome)">{{ outcomeLabel(log.outcome) }}</span>
                  <span class="contact-log-time">{{ fmtTs(log.contactedAt) }}</span>
                </div>
                <div class="contact-log-notes" v-if="log.notes">{{ log.notes }}</div>
                <div class="contact-log-by" v-if="log.loggedBy">{{ log.loggedBy }}</div>
              </div>
            </template>
            <div class="empty-section" style="padding:20px" v-else>
              <i class="ti ti-history"></i><p>No contact attempts logged</p>
            </div>
          </div>

        </template>
      </div>
    </div>
  `
};
// ================================================================
//  REMAINING SCREENS  (Steps 6–14: placeholders)
// ================================================================

// ================================================================
//  STEP 12: CONFIGURATION SCREEN
// ================================================================

const Config = {
  name: 'Config',
  data() {
    return {
      tab: 'services',
      services: [], loadingServices: true, savingService: false,
      showAddForm: false,
      addForm: { name:'', defaultAmount:'', category:'consultation' },
      editingId: null,
      editForm: { name:'', defaultAmount:'', category:'consultation' },
      clinicSettings: { ...DEFAULT_CLINIC_SETTINGS },
      loadingSettings: false, savingSettings: false,
      ancWeeks: [], loadingAnc: false, savingAnc: false, newWeek: '',
      reminderSchedules: { anc:[14,7,1], vaccination:[30,7,1], post_procedure:[3,1], annual_recall:[30,7,1] },
      loadingReminder: false, savingReminder: false,
      users: [], loadingUsers: false,
      showAddUser: false,
      addUserForm: { email:'', name:'', role:'staff' }
    };
  },
  computed: {
    serviceCategories() { return SERVICE_CATEGORIES; }
  },
  methods: {
    async switchTab(t) {
      this.tab = t;
      if (t === 'services')  await this.loadServices();
      if (t === 'clinic')    await this.loadClinicSettings();
      if (t === 'anc')       await this.loadAncSchedule();
      if (t === 'reminder')  await this.loadReminderSchedules();
      if (t === 'users')     await this.loadUsers();
    },
    async loadServices() {
      this.loadingServices = true;
      try { this.services = await getAllServices(); }
      finally { this.loadingServices = false; }
    },
    async addService() {
      if (!this.addForm.name.trim()) return;
      this.savingService = true;
      try { await createService(this.addForm); this.addForm={name:'',defaultAmount:'',category:'consultation'}; this.showAddForm=false; await this.loadServices(); }
      catch(e){ alert('Error saving.'); } finally { this.savingService=false; }
    },
    startEdit(s) { this.editingId=s.id; this.editForm={name:s.name,defaultAmount:s.defaultAmount,category:s.category||'consultation'}; },
    cancelEdit() { this.editingId=null; },
    async saveEdit() {
      this.savingService=true;
      try { await updateService(this.editingId,this.editForm); this.editingId=null; await this.loadServices(); }
      catch(e){ alert('Error.'); } finally { this.savingService=false; }
    },
    async toggleActive(s) { await toggleServiceActive(s.id,!s.isActive); await this.loadServices(); },
    async removeService(id) { if(!confirm('Delete this service?')) return; await deleteService(id); await this.loadServices(); },
    catLabel(c) { const x=SERVICE_CATEGORIES.find(s=>s.value===c); return x?x.label:c; },
    fmtAmt(n) { return fmtAmount(n); },
    async loadClinicSettings() { this.loadingSettings=true; try { this.clinicSettings=await getClinicSettings(); } finally { this.loadingSettings=false; } },
    async saveSettings() { this.savingSettings=true; try { await saveClinicSettings(this.clinicSettings); alert('Saved.'); } finally { this.savingSettings=false; } },
    async loadAncSchedule() { this.loadingAnc=true; try { this.ancWeeks=await getAncScheduleConfig(); } finally { this.loadingAnc=false; } },
    addAncWeek() { const w=parseInt(this.newWeek); if(w>0&&!this.ancWeeks.includes(w)){ this.ancWeeks=[...this.ancWeeks,w].sort((a,b)=>a-b); this.newWeek=''; } },
    removeAncWeek(i) { this.ancWeeks=this.ancWeeks.filter((_,idx)=>idx!==i); },
    async saveAncSchedule() {
      this.savingAnc=true;
      try { await saveAncScheduleConfig(this.ancWeeks.map(Number).filter(n=>n>0).sort((a,b)=>a-b)); alert('ANC schedule saved.'); }
      finally { this.savingAnc=false; }
    },
    async loadReminderSchedules() { this.loadingReminder=true; try { this.reminderSchedules=await getReminderSchedulesConfig(); } finally { this.loadingReminder=false; } },
    async saveReminderSchedules() {
      this.savingReminder=true;
      try { await saveReminderSchedulesConfig(this.reminderSchedules); alert('Reminder schedules saved.'); }
      finally { this.savingReminder=false; }
    },
    reminderTypes() { return [
      {key:'anc',label:'ANC visits'},{key:'vaccination',label:'Vaccination'},
      {key:'post_procedure',label:'Post-procedure'},{key:'annual_recall',label:'Annual recall'}
    ]; },
    addReminderDay(type) {
      const c = this.reminderSchedules[type] || [];
      this.reminderSchedules = { ...this.reminderSchedules, [type]: [...c, 7] };
    },
    removeReminderDay(type, i) {
      const c = [...(this.reminderSchedules[type]||[])]; c.splice(i,1);
      this.reminderSchedules = { ...this.reminderSchedules, [type]: c };
    },
    async loadUsers() {
      this.loadingUsers=true;
      try { this.users = await getUsers(); } finally { this.loadingUsers=false; }
    },
    async saveAddUser() {
      if (!this.addUserForm.email.trim()) return;
      try { await addUser(this.addUserForm.email, this.addUserForm); this.addUserForm={email:'',name:'',role:'staff'}; this.showAddUser=false; await this.loadUsers(); }
      catch(e){ alert('Error: '+e.message); }
    },
    async changeRole(u, role) { await updateUserRole(u.id, role); await this.loadUsers(); },
    async toggleUser(u) { await toggleUserActive(u.id, !u.isActive); await this.loadUsers(); },
    async deleteUser(u) { if(!confirm('Remove '+u.id+'?')) return; await removeUser(u.id); await this.loadUsers(); },
    roleLabel(r) { return r==='doctor'?'Doctor':'Staff'; }
  },
  mounted() { this.loadServices(); },
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i> Dashboard</button><span class="sep">/</span><span class="current">Settings</span></div></div></div>
      <div class="content">
        <div class="config-tab-bar">
          <button class="config-tab" :class="{on:tab==='services'}" @click="switchTab('services')"><i class="ti ti-list-check"></i> Services</button>
          <button class="config-tab" :class="{on:tab==='clinic'}"   @click="switchTab('clinic')"><i class="ti ti-building"></i> Clinic</button>
          <button class="config-tab" :class="{on:tab==='anc'}"      @click="switchTab('anc')"><i class="ti ti-heart-rate-monitor"></i> ANC schedule</button>
          <button class="config-tab" :class="{on:tab==='reminder'}" @click="switchTab('reminder')"><i class="ti ti-bell"></i> Reminders</button>
          <button class="config-tab" :class="{on:tab==='users'}"    @click="switchTab('users')"><i class="ti ti-users"></i> Users</button>
        </div>

        <!-- SERVICES TAB -->
        <template v-if="tab==='services'">
          <div class="section-header">
            <div class="section-title">Services master list</div>
            <button class="btn btn-primary btn-sm" @click="showAddForm=!showAddForm"><i class="ti ti-plus"></i> Add service</button>
          </div>
          <div class="detail-card" v-if="showAddForm" style="margin-bottom:14px">
            <p class="form-section-title" style="margin-top:0">New service</p>
            <div class="form-row">
              <div class="form-group"><label class="form-label">Name <span class="form-required">*</span></label><input type="text" v-model="addForm.name" class="form-input" placeholder="e.g. ANC Consultation" /></div>
              <div class="form-group"><label class="form-label">Default amount (₹)</label><input type="number" v-model="addForm.defaultAmount" class="form-input" placeholder="500" min="0" /></div>
            </div>
            <div class="form-group"><label class="form-label">Category</label><select v-model="addForm.category" class="form-select"><option v-for="c in serviceCategories" :key="c.value" :value="c.value">{{ c.label }}</option></select></div>
            <div style="display:flex;gap:8px;margin-top:4px">
              <button class="btn btn-primary btn-sm" @click="addService" :disabled="savingService||!addForm.name.trim()"><i class="ti ti-check"></i> {{ savingService ? 'Saving…' : 'Save service' }}</button>
              <button class="btn btn-secondary btn-sm" @click="showAddForm=false">Cancel</button>
            </div>
          </div>
          <div class="loading-wrap" v-if="loadingServices"><i class="ti ti-loader spin"></i></div>
          <div class="section-card" v-else-if="services.length">
            <template v-for="s in services" :key="s.id">
              <div class="service-item" :class="{inactive:!s.isActive}" v-if="editingId!==s.id">
                <div style="flex:1"><div class="service-name">{{ s.name }}</div><div class="service-cat">{{ catLabel(s.category) }}</div></div>
                <div class="service-amount">{{ fmtAmt(s.defaultAmount) }}</div>
                <button :class="'toggle-btn '+(s.isActive?'on':'off')" @click="toggleActive(s)"></button>
                <button class="action-btn" style="border-color:var(--border-mid)" @click="startEdit(s)"><i class="ti ti-edit"></i></button>
                <button class="action-btn action-btn-flag" @click="removeService(s.id)"><i class="ti ti-trash"></i></button>
              </div>
              <div class="service-item" v-else style="flex-direction:column;align-items:stretch;gap:8px">
                <div class="form-row" style="margin-bottom:0">
                  <input type="text" v-model="editForm.name" class="form-input" placeholder="Service name" />
                  <input type="number" v-model="editForm.defaultAmount" class="form-input" placeholder="Amount" style="width:120px;flex-shrink:0" />
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <select v-model="editForm.category" class="form-select" style="flex:1"><option v-for="c in serviceCategories" :key="c.value" :value="c.value">{{ c.label }}</option></select>
                  <button class="btn btn-primary btn-sm" @click="saveEdit" :disabled="savingService"><i class="ti ti-check"></i> Save</button>
                  <button class="btn btn-secondary btn-sm" @click="cancelEdit">Cancel</button>
                </div>
              </div>
            </template>
          </div>
          <div class="empty-section" v-else><i class="ti ti-list-check"></i><p>No services yet. Add your first service above.</p></div>
        </template>

        <!-- CLINIC TAB -->
        <template v-if="tab==='clinic'">
          <div class="loading-wrap" v-if="loadingSettings"><i class="ti ti-loader spin"></i></div>
          <div class="form-card" style="max-width:500px" v-else>
            <div class="form-card-title">Clinic information</div>
            <div class="form-group"><label class="form-label">Clinic name</label><input type="text" v-model="clinicSettings.name" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Subtitle</label><input type="text" v-model="clinicSettings.subtitle" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Address</label><textarea v-model="clinicSettings.address" class="form-input" rows="2" style="resize:vertical"></textarea></div>
            <div class="form-row">
              <div class="form-group"><label class="form-label">Phone</label><input type="tel" v-model="clinicSettings.phone" class="form-input" /></div>
              <div class="form-group"><label class="form-label">Email</label><input type="email" v-model="clinicSettings.email" class="form-input" /></div>
            </div>
            <div class="form-actions"><button class="btn btn-primary" @click="saveSettings" :disabled="savingSettings"><i class="ti ti-check"></i> {{ savingSettings ? 'Saving…' : 'Save clinic info' }}</button></div>
          </div>
        </template>

        <!-- ANC SCHEDULE TAB -->
        <template v-if="tab==='anc'">
          <div class="loading-wrap" v-if="loadingAnc"><i class="ti ti-loader spin"></i></div>
          <div class="form-card" style="max-width:500px" v-else>
            <div class="form-card-title">ANC visit schedule</div>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Weeks from LMP at which ANC visits are scheduled. Changes apply to new follow-up creations.</p>
            <div class="week-tag-list">
              <div class="week-tag" v-for="(w,i) in ancWeeks" :key="i">Week {{ w }}<button class="week-tag-remove" @click="removeAncWeek(i)"><i class="ti ti-x"></i></button></div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:16px">
              <input type="number" v-model="newWeek" class="form-input" placeholder="Week number (e.g. 36)" style="width:200px" min="1" max="44" @keyup.enter="addAncWeek" />
              <button class="btn btn-secondary" @click="addAncWeek"><i class="ti ti-plus"></i> Add</button>
            </div>
            <div class="form-actions"><button class="btn btn-primary" @click="saveAncSchedule" :disabled="savingAnc"><i class="ti ti-check"></i> {{ savingAnc ? 'Saving…' : 'Save schedule' }}</button></div>
          </div>
        </template>

        <!-- USERS TAB -->
        <template v-if="tab==='users'">
          <div class="section-header">
            <div class="section-title">Access &amp; roles</div>
            <button class="btn btn-primary btn-sm" @click="showAddUser=!showAddUser"><i class="ti ti-plus"></i> Add user</button>
          </div>
          <div class="detail-card" v-if="showAddUser" style="margin-bottom:14px">
            <p class="form-section-title" style="margin-top:0">New user</p>
            <div class="form-row">
              <div class="form-group"><label class="form-label">Email <span class="form-required">*</span></label><input type="email" v-model="addUserForm.email" class="form-input" placeholder="user@gmail.com" /></div>
              <div class="form-group"><label class="form-label">Display name</label><input type="text" v-model="addUserForm.name" class="form-input" placeholder="Dr. Name" /></div>
            </div>
            <div class="form-group"><label class="form-label">Role</label>
              <select v-model="addUserForm.role" class="form-select" style="max-width:200px">
                <option value="doctor">Doctor</option><option value="staff">Staff</option>
              </select>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px">
              <button class="btn btn-primary btn-sm" @click="saveAddUser" :disabled="!addUserForm.email.trim()"><i class="ti ti-check"></i> Add user</button>
              <button class="btn btn-secondary btn-sm" @click="showAddUser=false">Cancel</button>
            </div>
          </div>
          <div class="loading-wrap" v-if="loadingUsers"><i class="ti ti-loader spin"></i></div>
          <div class="section-card" v-else-if="users.length">
            <div class="user-row" v-for="u in users" :key="u.id" :style="u.isActive===false?'opacity:0.5':''">
              <div class="user-name-col">{{ u.name||u.id }}</div>
              <div class="user-email-col">{{ u.id }}</div>
              <span :class="'role-badge role-'+u.role">{{ roleLabel(u.role) }}</span>
              <select :value="u.role" @change="changeRole(u,$event.target.value)" class="form-select" style="width:110px;font-size:12px;padding:4px 8px">
                <option value="doctor">Doctor</option><option value="staff">Staff</option>
              </select>
              <button :class="(u.isActive!==false?'toggle-btn on':'toggle-btn off')" @click="toggleUser(u)"></button>
              <button class="action-btn action-btn-flag" @click="deleteUser(u)"><i class="ti ti-trash"></i></button>
            </div>
          </div>
          <div class="empty-section" v-else><i class="ti ti-users"></i><p>No users yet. Add the first user above.<br><small style="color:var(--text-muted)">Note: legacy whitelist users still have access until added here.</small></p></div>
        </template>

        <!-- REMINDER SCHEDULES TAB -->
        <template v-if="tab==='reminder'">
          <div class="loading-wrap" v-if="loadingReminder"><i class="ti ti-loader spin"></i></div>
          <div class="form-card" style="max-width:560px" v-else>
            <div class="form-card-title">Reminder schedules</div>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Days before due date on which reminders are generated. Changes apply to new follow-up creations.</p>
            <div v-for="type in reminderTypes()" :key="type.key" style="margin-bottom:20px">
              <p class="form-section-title" style="margin-top:0">{{ type.label }}</p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
                <div v-for="(day,i) in (reminderSchedules[type.key]||[])" :key="i" class="week-tag">{{ day }} day{{ day===1?'':'s' }} before<button class="week-tag-remove" @click="removeReminderDay(type.key,i)"><i class="ti ti-x"></i></button></div>
                <button class="btn btn-secondary btn-sm" @click="addReminderDay(type.key)"><i class="ti ti-plus"></i> Add interval</button>
              </div>
            </div>
            <div class="form-actions"><button class="btn btn-primary" @click="saveReminderSchedules" :disabled="savingReminder"><i class="ti ti-check"></i> {{ savingReminder ? 'Saving…' : 'Save schedules' }}</button></div>
          </div>
        </template>
      </div>
    </div>
  `
};

// ================================================================
//  STEP 12: ANALYTICS / REPORTS SCREEN
// ================================================================
//  DASHBOARD — tile home screen
// ================================================================

const Appointments = {
  name: 'Appointments',
  data() {
    return {
      date: todayIso(),
      appts: [], loading: true, loadError: null,
      savingId: null
    };
  },
  computed: {
    dateLabel() {
      const [y,m,d] = this.date.split('-').map(Number);
      return new Date(y,m-1,d).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    },
    isToday()  { return this.date === todayIso(); },
    byDoctor() {
      const seen = new Set();
      const order = [];
      this.appts.forEach(a => { if (!seen.has(a.doctorName)) { seen.add(a.doctorName); order.push(a.doctorName); } });
      return order.map(doc => ({
        doctor: doc,
        appts:  this.appts.filter(a => a.doctorName === doc)
      }));
    },
    stats() {
      const a = this.appts;
      return {
        total:     a.length,
        scheduled: a.filter(x => x.status==='scheduled').length,
        seen:      a.filter(x => x.status==='seen').length,
        noShow:    a.filter(x => x.status==='no_show').length,
        cancelled: a.filter(x => x.status==='cancelled').length
      };
    }
  },
  methods: {
    async load() {
      this.loading=true; this.loadError=null;
      try { this.appts = await getAppointmentsByDate(this.date); }
      catch(e) { this.loadError='Could not load appointments.'; }
      finally { this.loading=false; }
    },
    prevDay()  { this.date = addDays(this.date,-1); this.load(); },
    nextDay()  { this.date = addDays(this.date, 1); this.load(); },
    goToday()  { this.date = todayIso(); this.load(); },
    async markSeen(appt) {
      if (this.savingId) return;
      this.savingId = appt.id;
      try {
        await updateAppointmentStatus(appt.id, 'seen');
        appt.status = 'seen';
        if (appt.patientId && confirm('Open encounter form for ' + appt.patientName + '?')) {
          this.$router.push('/encounters/new?patientId=' + appt.patientId);
        }
      } finally { this.savingId = null; }
    },
    async markNoShow(appt) {
      if (this.savingId) return;
      this.savingId = appt.id;
      try { await updateAppointmentStatus(appt.id,'no_show'); appt.status='no_show'; }
      finally { this.savingId = null; }
    },
    async cancel(appt) {
      if (!confirm('Cancel appointment for ' + appt.patientName + '?')) return;
      this.savingId = appt.id;
      try { await updateAppointmentStatus(appt.id,'cancelled'); appt.status='cancelled'; }
      finally { this.savingId = null; }
    },
    waLink(appt) {
      const [y,m,d] = this.date.split('-').map(Number);
      const lbl = new Date(y,m-1,d).toLocaleDateString('en-IN',{day:'numeric',month:'long'});
      return appointmentWaLink(appt, lbl);
    },
    typeLabel(t) { return (APPOINTMENT_TYPES.find(x=>x.value===t)||{}).label||t||'\u2014'; },
    statusCls(s) { return {scheduled:'pill-teal',seen:'pill-green',no_show:'pill-amber',cancelled:'pill-gray'}[s]||'pill-gray'; },
    statusTxt(s) { return {scheduled:'Scheduled',seen:'Seen',no_show:'No-show',cancelled:'Cancelled'}[s]||s; }
  },
  mounted() { this.load(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i> Dashboard</button><span class="sep">/</span><span class="current">Appointments</span></div></div>
        <div class="topbar-right">
          <button class="btn btn-secondary btn-sm" @click="load" :disabled="loading"><i class="ti ti-refresh"></i> Refresh</button>
          <button class="btn btn-primary" @click="$router.push('/appointments/new')"><i class="ti ti-calendar-plus"></i> Book appointment</button>
        </div>
      </div>
      <div class="content">

        <!-- Date navigator -->
        <div class="appt-date-nav">
          <button class="date-nav-btn" @click="prevDay"><i class="ti ti-chevron-left"></i></button>
          <div class="appt-date-label">{{ dateLabel }}</div>
          <button class="date-nav-btn" @click="nextDay"><i class="ti ti-chevron-right"></i></button>
          <button class="appt-today-btn" v-if="!isToday" @click="goToday">Today</button>
        </div>

        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="empty-section" v-else-if="loadError"><i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p></div>

        <template v-else>
          <!-- Stats row -->
          <div class="appt-stat-row">
            <div class="appt-stat"><div class="appt-stat-num">{{ stats.total }}</div><div class="appt-stat-lbl">Total</div></div>
            <div class="appt-stat"><div class="appt-stat-num" style="color:var(--teal-mid)">{{ stats.scheduled }}</div><div class="appt-stat-lbl">Waiting</div></div>
            <div class="appt-stat"><div class="appt-stat-num" style="color:#2e7d32">{{ stats.seen }}</div><div class="appt-stat-lbl">Seen</div></div>
            <div class="appt-stat"><div class="appt-stat-num" style="color:var(--amber-mid)">{{ stats.noShow }}</div><div class="appt-stat-lbl">No-show</div></div>
            <div class="appt-stat"><div class="appt-stat-num" style="color:var(--text-muted)">{{ stats.cancelled }}</div><div class="appt-stat-lbl">Cancelled</div></div>
          </div>

          <!-- Empty day -->
          <div class="empty-section" v-if="appts.length===0">
            <i class="ti ti-calendar" style="font-size:36px;opacity:.4"></i>
            <p>No appointments booked for this day</p>
            <button class="btn btn-primary" style="margin-top:12px" @click="$router.push('/appointments/new')"><i class="ti ti-calendar-plus"></i> Book first appointment</button>
          </div>

          <!-- Per-doctor groups -->
          <template v-else>
            <div v-for="group in byDoctor" :key="group.doctor" style="margin-bottom:18px">
              <div class="section-header">
                <div class="section-title"><i class="ti ti-stethoscope" style="color:var(--teal-mid)"></i> {{ group.doctor }}</div>
                <div class="section-count">{{ group.appts.filter(a=>a.status==='scheduled').length }} waiting &middot; {{ group.appts.length }} total</div>
              </div>
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr>
                    <th style="width:32px">#</th>
                    <th>Patient</th>
                    <th>Mobile</th>
                    <th>Type</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th style="width:160px">Actions</th>
                  </tr></thead>
                  <tbody>
                    <tr v-for="(appt, i) in group.appts" :key="appt.id"
                        :style="appt.status==='cancelled'?'opacity:0.5':appt.status==='seen'?'opacity:0.75':''">
                      <td class="td-muted" style="font-weight:600">{{ i+1 }}</td>
                      <td>
                        <span class="td-name">{{ appt.patientName }}</span>
                        <span class="walkin-badge" v-if="appt.isWalkIn">Walk-in</span>
                      </td>
                      <td class="td-muted">{{ appt.mobile||'\u2014' }}</td>
                      <td><span class="pill pill-teal" style="font-size:10px">{{ typeLabel(appt.type) }}</span></td>
                      <td class="td-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ appt.notes||'\u2014' }}</td>
                      <td><span class="pill" :class="statusCls(appt.status)" style="font-size:10px">{{ statusTxt(appt.status) }}</span></td>
                      <td>
                        <template v-if="appt.status==='scheduled'">
                          <div style="display:flex;gap:4px">
                            <a v-if="waLink(appt)" :href="waLink(appt)" target="_blank" class="action-btn action-btn-wa" title="Send WA reminder"><i class="ti ti-brand-whatsapp"></i></a>
                            <button class="action-btn" style="color:var(--teal-mid);border-color:var(--teal-border)" @click="markSeen(appt)" :disabled="savingId===appt.id" title="Mark seen"><i class="ti ti-check"></i> Seen</button>
                            <button class="action-btn" style="color:var(--amber-mid);border-color:var(--amber-border)" @click="markNoShow(appt)" :disabled="savingId===appt.id" title="No-show"><i class="ti ti-user-x"></i></button>
                            <button class="action-btn action-btn-flag" @click="cancel(appt)" :disabled="savingId===appt.id" title="Cancel"><i class="ti ti-x"></i></button>
                          </div>
                        </template>
                        <template v-else-if="appt.status==='seen'&&appt.patientId">
                          <button class="action-btn" style="font-size:11px" @click="$router.push('/encounters/new?patientId='+appt.patientId)"><i class="ti ti-stethoscope"></i> Encounter</button>
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  `
};

// ================================================================
//  NEW APPOINTMENT
// ================================================================

const NewAppointment = {
  name: 'NewAppointment',
  data() {
    return {
      isWalkIn: false,
      patientQuery: '', patientResults: [], searchingPatients: false,
      selectedPatient: null,
      form: {
        patientName: '',
        mobile:      '',
        date:        todayIso(),
        doctorName:  CLINIC_DOCTORS[0] || '',
        type:        'consultation',
        notes:       ''
      },
      saving: false, errors: {}
    };
  },
  computed: {
    doctors()       { return CLINIC_DOCTORS; },
    apptTypes()     { return APPOINTMENT_TYPES; }
  },
  methods: {
    async doSearch() {
      if (this.patientQuery.length < 2) { this.patientResults=[]; return; }
      this.searchingPatients = true;
      try {
        const all = await getAllPatients();
        const q = this.patientQuery.toLowerCase();
        this.patientResults = all.filter(p =>
          (p.name||'').toLowerCase().includes(q) ||
          (p.mobile||'').includes(q) ||
          (p.patientId||'').toLowerCase().includes(q)
        ).slice(0, 8);
      } finally { this.searchingPatients=false; }
    },
    selectPatient(p) {
      this.selectedPatient = p;
      this.form.patientName = p.name;
      this.form.mobile      = p.mobile || '';
      this.patientQuery     = p.name;
      this.patientResults   = [];
      if (p.type === 'child') this.form.doctorName = 'Dr. Abhishek Bansal';
    },
    clearPatient() {
      this.selectedPatient=null; this.patientQuery='';
      this.form.patientName=''; this.form.mobile='';
    },
    toggleWalkIn() {
      this.isWalkIn = !this.isWalkIn;
      this.clearPatient();
    },
    validate() {
      this.errors={};
      if (!this.form.patientName.trim()) this.errors.name='Patient name is required';
      if (!this.form.date)               this.errors.date='Date is required';
      if (!this.form.doctorName)         this.errors.doctor='Doctor is required';
      return Object.keys(this.errors).length===0;
    },
    async save() {
      if (!this.validate()) return;
      this.saving=true;
      try {
        await createAppointment({
          patientId:   this.selectedPatient ? this.selectedPatient.id : null,
          patientName: this.form.patientName,
          mobile:      this.form.mobile,
          date:        this.form.date,
          doctorName:  this.form.doctorName,
          type:        this.form.type,
          notes:       this.form.notes
        });
        this.$router.push('/appointments');
      } catch(e) { alert('Error: '+e.message); }
      finally { this.saving=false; }
    },
    initials(n) { return patientInitials(n); },
    avCls(n)    { return patientAvatarClass(n); }
  },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="$router.push('/appointments')"><i class="ti ti-arrow-left"></i> Appointments</button>
            <span class="sep">/</span><span class="current">Book appointment</span>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="form-card" style="max-width:680px">
          <div class="form-card-title">Book appointment</div>

          <!-- Patient selection -->
          <p class="form-section-title">Patient</p>
          <div style="display:flex;gap:8px;margin-bottom:10px">
            <button class="btn" :class="!isWalkIn?'btn-primary':'btn-secondary'" @click="isWalkIn=false"><i class="ti ti-search"></i> Existing patient</button>
            <button class="btn" :class="isWalkIn?'btn-primary':'btn-secondary'"  @click="toggleWalkIn"><i class="ti ti-user-plus"></i> Walk-in</button>
          </div>

          <!-- Existing patient search -->
          <template v-if="!isWalkIn">
            <div class="patient-search-wrap" style="position:relative;margin-bottom:4px">
              <div class="search-wrap">
                <i class="ti ti-search"></i>
                <input type="text" v-model="patientQuery" class="search-input" placeholder="Search by name, mobile, or patient ID\u2026" @input="doSearch" :disabled="!!selectedPatient" />
                <button class="search-clear" v-if="selectedPatient" @click="clearPatient"><i class="ti ti-x"></i></button>
              </div>
              <div class="patient-dropdown" v-if="patientResults.length" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid var(--border);border-radius:8px;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,.1);max-height:240px;overflow-y:auto">
                <div class="patient-result" v-for="p in patientResults" :key="p.id" @click="selectPatient(p)" style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border)">
                  <div class="avatar avatar-sm" :class="avCls(p.name)">{{ initials(p.name) }}</div>
                  <div><div style="font-size:13px;font-weight:500">{{ p.name }}</div><div style="font-size:11px;color:var(--text-muted)">{{ p.patientId }} \u00b7 {{ p.mobile }}</div></div>
                  <span class="pill pill-blue" v-if="p.type==='child'" style="margin-left:auto;font-size:10px">Child</span>
                </div>
              </div>
            </div>
            <div v-if="selectedPatient" class="detail-card" style="margin-bottom:10px;display:flex;align-items:center;gap:10px">
              <div class="avatar avatar-sm" :class="avCls(selectedPatient.name)">{{ initials(selectedPatient.name) }}</div>
              <div><div style="font-size:13px;font-weight:500">{{ selectedPatient.name }}</div><div style="font-size:11px;color:var(--text-muted)">{{ selectedPatient.patientId }} \u00b7 {{ selectedPatient.mobile }}</div></div>
              <span class="pill pill-blue" v-if="selectedPatient.type==='child'" style="margin-left:auto;font-size:10px">Child \u2014 auto-assigned to Dr. Abhishek</span>
            </div>
            <p class="form-error" v-if="errors.name">{{ errors.name }}</p>
          </template>

          <!-- Walk-in fields -->
          <template v-else>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Name <span class="form-required">*</span></label>
                <input type="text" v-model="form.patientName" class="form-input" :class="{error:errors.name}" placeholder="Patient name" />
                <p class="form-error" v-if="errors.name">{{ errors.name }}</p>
              </div>
              <div class="form-group">
                <label class="form-label">Mobile</label>
                <input type="tel" v-model="form.mobile" class="form-input" placeholder="10-digit mobile" />
              </div>
            </div>
          </template>

          <!-- Appointment details -->
          <p class="form-section-title">Appointment details</p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date <span class="form-required">*</span></label>
              <input type="date" v-model="form.date" class="form-input" :class="{error:errors.date}" />
              <p class="form-error" v-if="errors.date">{{ errors.date }}</p>
            </div>
            <div class="form-group">
              <label class="form-label">Doctor <span class="form-required">*</span></label>
              <select v-model="form.doctorName" class="form-select" :class="{error:errors.doctor}">
                <option v-for="d in doctors" :key="d" :value="d">{{ d }}</option>
              </select>
              <p class="form-error" v-if="errors.doctor">{{ errors.doctor }}</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Type</label>
              <select v-model="form.type" class="form-select">
                <option v-for="t in apptTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <input type="text" v-model="form.notes" class="form-input" placeholder="Optional notes" />
            </div>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" @click="save" :disabled="saving">
              <i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-calendar-check" v-else></i>
              {{ saving ? 'Booking\u2026' : 'Book appointment' }}
            </button>
            <button class="btn btn-secondary" @click="$router.push('/appointments')">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};


// ================================================================
//  DASHBOARD — daily operations centre
// ================================================================

// ================================================================
//  DASHBOARD — tile home screen
// ================================================================

// ================================================================
//  DASHBOARD  (landing screen)
// ================================================================

const Dashboard = {
  name: 'Dashboard',
  data() {
    return {
      stats: null, loading: true,
      reminders: [], recentInvoices: [], todayAppts: [],
      loadingQ: true, loadingInv: true, loadingAppts: true
    };
  },
  computed: {
    greeting() {
      const h = new Date().getHours();
      if (h < 12) return 'Good morning';
      if (h < 17) return 'Good afternoon';
      return 'Good evening';
    },
    todayLabel() {
      return new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    },
    role()      { return this.$root.role; },
    firstName() {
      const n = this.$root.userName || (this.$root.user && this.$root.user.displayName) || '';
      return n.split(' ')[0] || 'there';
    }
  },
  methods: {
    async loadAll() {
      this.loading = true; this.loadingQ = true; this.loadingInv = true; this.loadingAppts = true;
      getDashboardStats(this.$root.role)
        .then(s => { this.stats = s; }).finally(() => { this.loading = false; });
      getTodaysPendingReminders()
        .then(r => { this.reminders = r.slice(0,6); }).finally(() => { this.loadingQ = false; });
      getTodayAppointments()
        .then(a => { this.todayAppts = a; }).finally(() => { this.loadingAppts = false; });
      if (this.$root.role === 'doctor') {
        getRecentInvoicesForDashboard()
          .then(inv => { this.recentInvoices = inv; }).finally(() => { this.loadingInv = false; });
      } else { this.loadingInv = false; }
    },
    async markSent(r) {
      await updateReminderStatus(r.id, 'sent');
      this.reminders = this.reminders.filter(x => x.id !== r.id);
      if (this.stats) this.stats.pendingToday = Math.max(0, this.stats.pendingToday - 1);
    },
    waLink(r)   { return buildReminderWaLink(r); },
    fmtAmt(n)   { return fmtAmount(n); },
    fmtDate(d)  { return fmtDateShort(d); },
    pillCls(t)  { return {anc:'pill-teal',vaccination:'pill-blue',post_procedure:'pill-gray',annual_recall:'pill-gray'}[t]||'pill-gray'; },
    pillTxt(t)  { return {anc:'ANC',vaccination:'Vaccine',post_procedure:'Post-op',annual_recall:'Recall'}[t]||'Follow-up'; },
    initials(n) { return patientInitials(n); }
  },
  mounted() { this.loadAll(); },
  template: `
    <div class="screen">
      <div class="content">
        <div class="dash-header">
          <div class="dash-greeting">{{ greeting }}, {{ firstName }}</div>
          <div class="dash-date">{{ todayLabel }}</div>
        </div>
        <div class="dash-stats" v-if="stats || loading || !loadingAppts">
          <div class="dash-stat teal" @click="$router.push('/appointments')" style="cursor:pointer">
            <div class="dash-stat-label">Appointments today</div>
            <div class="dash-stat-value">{{ loadingAppts ? '\u2014' : todayAppts.filter(a=>a.status==='scheduled').length }}</div>
            <div class="dash-stat-sub">{{ loadingAppts ? '' : todayAppts.length + ' booked total' }}</div>
          </div>
          <div class="dash-stat stat-warm" @click="$router.push('/followups')" style="cursor:pointer">
            <div class="dash-stat-label">Reminders today</div>
            <div class="dash-stat-value">{{ loading ? '\u2014' : (stats ? stats.pendingToday : 0) }}</div>
            <div class="dash-stat-sub">Pending to send</div>
          </div>
          <div class="dash-stat amber" @click="$router.push('/followups')" style="cursor:pointer">
            <div class="dash-stat-label">Overdue cases</div>
            <div class="dash-stat-value">{{ loading ? '\u2014' : (stats ? stats.overdueCount : 0) }}</div>
            <div class="dash-stat-sub">Past due date</div>
          </div>
          <div class="dash-stat blue" @click="$router.push('/patients')" style="cursor:pointer">
            <div class="dash-stat-label">New this month</div>
            <div class="dash-stat-value">{{ loading ? '\u2014' : (stats ? stats.monthPatients : 0) }}</div>
            <div class="dash-stat-sub">Patients registered</div>
          </div>
          <div class="dash-stat stat-dark" v-if="role==='doctor'" @click="$router.push('/billing')" style="cursor:pointer">
            <div class="dash-stat-label">Today\u2019s revenue</div>
            <div class="dash-stat-value" style="font-size:20px;color:var(--teal-mid)">{{ loading ? '\u2014' : fmtAmt(stats ? stats.todayRevenue : 0) }}</div>
            <div class="dash-stat-sub">{{ !loading && stats ? stats.todayInvoiceCount + ' invoice' + (stats.todayInvoiceCount===1?'':'s') : '' }}</div>
          </div>
        </div>
        <div class="dash-actions">
          <button class="dash-action-btn primary" @click="$router.push('/appointments/new')"><i class="ti ti-calendar-plus"></i> Book appointment</button>
          <button class="dash-action-btn" @click="$router.push('/patients/new')"><i class="ti ti-user-plus"></i> New patient</button>
          <button class="dash-action-btn" @click="$router.push('/followups/new')"><i class="ti ti-calendar-check"></i> New follow-up</button>
          <button class="dash-action-btn" @click="$router.push('/encounters/new')"><i class="ti ti-stethoscope"></i> New encounter</button>
          <button class="dash-action-btn" @click="$router.push('/billing/new')"><i class="ti ti-receipt"></i> New invoice</button>
        </div>
        <div class="dash-cols">
          <div class="dash-panel">
            <div class="dash-panel-header">
              <span class="dash-panel-title"><i class="ti ti-brand-whatsapp" style="color:var(--teal-mid)"></i> Today\u2019s reminders</span>
              <button class="dash-panel-link" @click="$router.push('/followups')">View all \u2192</button>
            </div>
            <div class="loading-wrap" style="padding:24px" v-if="loadingQ"><i class="ti ti-loader spin"></i></div>
            <div class="dash-panel-empty" v-else-if="reminders.length===0"><i class="ti ti-circle-check" style="font-size:22px;color:var(--teal-mid)"></i><br>All clear \u2014 no pending reminders</div>
            <template v-else>
              <div class="dash-panel-row" v-for="r in reminders" :key="r.id">
                <div class="avatar avatar-sm" :class="pillCls(r.followupType)==='pill-teal'?'avatar-teal':'avatar-blue'">{{ initials(r.patientName) }}</div>
                <div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px">{{ r.patientName }}</div><div style="font-size:11px;color:var(--text-muted)">{{ r.subType }}</div></div>
                <span class="pill" :class="pillCls(r.followupType)" style="font-size:10px;flex-shrink:0">{{ pillTxt(r.followupType) }}</span>
                <a v-if="waLink(r)" :href="waLink(r)" target="_blank" class="action-btn action-btn-wa" style="flex-shrink:0"><i class="ti ti-brand-whatsapp"></i></a>
                <button class="action-btn" style="flex-shrink:0;border-color:var(--teal-border);color:var(--teal-mid)" @click="markSent(r)"><i class="ti ti-check"></i></button>
              </div>
            </template>
          </div>
          <div class="dash-panel" v-if="role==='doctor'">
            <div class="dash-panel-header">
              <span class="dash-panel-title"><i class="ti ti-receipt" style="color:var(--teal-mid)"></i> Recent invoices</span>
              <button class="dash-panel-link" @click="$router.push('/billing')">View all \u2192</button>
            </div>
            <div class="loading-wrap" style="padding:24px" v-if="loadingInv"><i class="ti ti-loader spin"></i></div>
            <div class="dash-panel-empty" v-else-if="recentInvoices.length===0">No invoices yet</div>
            <template v-else>
              <div class="dash-panel-row" v-for="inv in recentInvoices" :key="inv.id" style="cursor:pointer" @click="$router.push('/billing/'+inv.id)">
                <div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px">{{ inv.patientName }}</div><div style="font-size:11px;color:var(--text-muted)">{{ inv.invoiceNumber }} \u00b7 {{ fmtDate(inv.date) }}</div></div>
                <div style="font-weight:600;color:var(--teal-mid);flex-shrink:0">{{ fmtAmt(inv.totalAmount) }}</div>
              </div>
            </template>
          </div>
          <div class="dash-panel" v-else>
            <div class="dash-panel-header">
              <span class="dash-panel-title"><i class="ti ti-calendar" style="color:var(--teal-mid)"></i> Today\u2019s appointments</span>
              <button class="dash-panel-link" @click="$router.push('/appointments')">View all \u2192</button>
            </div>
            <div class="loading-wrap" style="padding:20px" v-if="loadingAppts"><i class="ti ti-loader spin"></i></div>
            <div class="dash-panel-empty" v-else-if="todayAppts.length===0"><i class="ti ti-calendar" style="font-size:20px;opacity:.4"></i><br>No appointments today</div>
            <template v-else>
              <div class="dash-panel-row" v-for="a in todayAppts.slice(0,6)" :key="a.id">
                <div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px">{{ a.patientName }}<span class="walkin-badge" v-if="a.isWalkIn">Walk-in</span></div><div style="font-size:11px;color:var(--text-muted)">{{ a.doctorName }}</div></div>
                <span class="pill" :class="{scheduled:'pill-teal',seen:'pill-green',no_show:'pill-amber',cancelled:'pill-gray'}[a.status]||'pill-gray'" style="font-size:10px;flex-shrink:0">{{ {scheduled:'Scheduled',seen:'Seen',no_show:'No-show',cancelled:'Cancelled'}[a.status]||a.status }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  `
};


const FollowupList = {
  name: 'FollowupList',
  data() {
    return {
      view: 'queue',
      // Queue view
      qReminders: [], qMissed: [], qHighRisk: [],
      qLoading: true, qError: null,
      qLastRefreshed: null, showAllR: false, showAllM: false,
      // Cases view
      allCases: [], casesLoading: false, casesError: null,
      query: '', filterType: 'all', filterStatus: 'active'
    };
  },
  computed: {
    todayLabel() {
      return new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    },
    totalTasks()   { return this.qReminders.length + this.qMissed.length + this.qHighRisk.length; },
    visibleR()     { return this.showAllR ? this.qReminders : this.qReminders.slice(0,5); },
    visibleM()     { return this.showAllM ? this.qMissed    : this.qMissed.slice(0,5); },
    filteredCases() {
      let c = this.allCases;
      if (this.filterStatus !== 'all') c = c.filter(fc => fc.status === this.filterStatus);
      if (this.filterType   !== 'all') c = c.filter(fc => fc.followupType === this.filterType);
      if (this.query.trim()) {
        const q = this.query.toLowerCase();
        c = c.filter(fc => (fc.patientName||'').toLowerCase().includes(q)||(fc.patientId||'').toLowerCase().includes(q));
      }
      return c.sort((a,b) => (a.dueDate||'').localeCompare(b.dueDate||''));
    },
    overdueCnt() {
      const t = todayIso();
      return this.allCases.filter(fc => fc.status==='active' && fc.dueDate < t).length;
    }
  },
  methods: {
    async switchView(v) {
      this.view = v;
      if (v === 'queue' && !this.qLastRefreshed) await this.loadQueue();
      if (v === 'cases' && !this.allCases.length)  await this.loadCases();
    },
    // Queue methods
    async loadQueue() {
      this.qLoading=true; this.qError=null;
      try {
        const [reminders, allMissed] = await Promise.all([getTodaysPendingReminders(), getMissedFollowups()]);
        this.qReminders = reminders;
        const withDays = allMissed.map(fc => ({...fc, _daysOver: this.daysOver(fc.dueDate)}));
        this.qMissed   = withDays.filter(fc => fc._daysOver < 7);
        this.qHighRisk = withDays.filter(fc => fc._daysOver >= 7).sort((a,b) => b._daysOver-a._daysOver);
        this.qLastRefreshed = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
      } catch(e) { this.qError='Could not load queue.'; }
      finally { this.qLoading=false; }
    },
    async markSent(r) {
      try { await updateReminderStatus(r.id,'sent');    this.qReminders=this.qReminders.filter(x=>x.id!==r.id); }
      catch(e) { alert('Error.'); }
    },
    async markSkipped(r) {
      try { await updateReminderStatus(r.id,'skipped'); this.qReminders=this.qReminders.filter(x=>x.id!==r.id); }
      catch(e) { alert('Error.'); }
    },
    daysOver(dueDate) {
      if (!dueDate) return 0;
      const [y1,m1,d1] = todayIso().split('-').map(Number);
      const [y2,m2,d2] = dueDate.split('-').map(Number);
      return Math.max(0, Math.floor((new Date(y1,m1-1,d1)-new Date(y2,m2-1,d2))/86400000));
    },
    waLink(r)      { return buildReminderWaLink(r); },
    // Cases methods
    async loadCases() {
      this.casesLoading=true; this.casesError=null;
      try {
        const snap = await db.collection('followupCases').get();
        this.allCases = snap.docs.map(d=>({id:d.id,...d.data()}));
      } catch(e) { this.casesError='Could not load follow-ups.'; }
      finally { this.casesLoading=false; }
    },
    fmtDate(d)   { return fmtDateShort(d); },
    typePill(t)  { return {anc:'pill-teal',vaccination:'pill-blue',post_procedure:'pill-gray',annual_recall:'pill-gray'}[t]||'pill-gray'; },
    typeTxt(t)   { return {anc:'ANC',vaccination:'Vaccine',post_procedure:'Post-op',annual_recall:'Recall'}[t]||'Follow-up'; },
    initials(n)  { return patientInitials(n); },
    avCls(n)     { return patientAvatarClass(n); },
    statusCls(fc) {
      if (fc.status==='completed') return 'pill-green';
      if (fc.status==='declined')  return 'pill-gray';
      if (fc.dueDate < todayIso()) return 'pill-red';
      return 'pill-amber';
    },
    statusTxt(fc) {
      if (fc.status==='completed') return 'Done';
      if (fc.status==='declined')  return 'Declined';
      if (fc.dueDate < todayIso()) return 'Overdue';
      return 'Active';
    },
    dueCls(fc) {
      if (fc.status !== 'active') return '';
      return fc.dueDate < todayIso() ? 'color:var(--red-mid)' : '';
    },
    pillCls(t)  { return {anc:'pill-teal',vaccination:'pill-blue',post_procedure:'pill-gray',annual_recall:'pill-gray'}[t]||'pill-gray'; },
    pillTxt(t)  { return {anc:'ANC',vaccination:'Vaccine',post_procedure:'Post-op',annual_recall:'Recall'}[t]||'Follow-up'; },
    overdueText(d) { return d===1 ? '1 day over' : d+' days over'; }
  },
  mounted() { this.loadQueue(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i> Dashboard</button><span class="sep">/</span><span class="current">Follow-ups</span></div>
          <p v-if="view==='queue'">{{ todayLabel }}</p>
        </div>
        <div class="topbar-right">
          <button class="btn btn-secondary btn-sm" v-if="view==='queue'" @click="loadQueue" :disabled="qLoading"><i class="ti ti-refresh"></i> Refresh</button>
          <button class="btn btn-primary" @click="$router.push('/followups/new')"><i class="ti ti-plus"></i> New follow-up</button>
        </div>
      </div>
      <div class="content">

        <!-- View toggle -->
        <div class="config-tab-bar" style="margin-bottom:14px">
          <button class="config-tab" :class="{on:view==='queue'}" @click="switchView('queue')"><i class="ti ti-layout-list"></i> Today\u2019s queue</button>
          <button class="config-tab" :class="{on:view==='cases'}" @click="switchView('cases')"><i class="ti ti-table"></i> All cases</button>
        </div>

        <!-- ═══ QUEUE VIEW ═══ -->
        <template v-if="view==='queue'">
          <div class="loading-wrap" v-if="qLoading"><i class="ti ti-loader spin"></i> Loading queue\u2026</div>
          <div class="empty-section" v-else-if="qError"><i class="ti ti-alert-triangle"></i><p>{{ qError }}</p></div>
          <template v-else>
            <div class="stat-grid">
              <div class="stat-card stat-teal"><div class="stat-label">Reminders due</div><div class="stat-value">{{ qReminders.length }}</div></div>
              <div class="stat-card stat-amber"><div class="stat-label">Missed follow-ups</div><div class="stat-value">{{ qMissed.length }}</div></div>
              <div class="stat-card stat-red"><div class="stat-label">High-risk (7+ days)</div><div class="stat-value">{{ qHighRisk.length }}</div></div>
              <div class="stat-card"><div class="stat-label">Last refreshed</div><div class="stat-value" style="font-size:14px;color:var(--text-secondary)">{{ qLastRefreshed||'\u2014' }}</div></div>
            </div>
            <div class="empty-section" v-if="totalTasks===0" style="padding:60px 20px">
              <i class="ti ti-circle-check" style="font-size:40px;color:var(--teal-mid);opacity:.7"></i>
              <h2 style="color:var(--teal-mid);font-size:18px;margin-top:8px">All clear</h2>
              <p>No pending reminders or missed follow-ups for today</p>
            </div>
            <template v-else>
              <!-- Reminders -->
              <template v-if="qReminders.length">
                <div class="section-header">
                  <div class="section-title"><i class="ti ti-brand-whatsapp" style="color:var(--teal-mid)"></i> Reminders to send</div>
                  <div class="section-count">{{ qReminders.length }} pending</div>
                </div>
                <div class="card-list" style="margin-bottom:18px">
                  <div class="card-list-row" v-for="r in visibleR" :key="r.id">
                    <div class="avatar avatar-sm" :class="avCls(r.patientName)">{{ initials(r.patientName) }}</div>
                    <div class="q-patient">
                      <div class="q-name">{{ r.patientName }}</div>
                      <div class="q-sub">{{ r.subType }}</div>
                    </div>
                    <div class="q-meta">
                      <span class="pill" :class="pillCls(r.followupType)">{{ pillTxt(r.followupType) }}</span>
                      <span class="q-due">due {{ fmtDate(r.dueDate) }}</span>
                    </div>
                    <div class="q-actions">
                      <a v-if="waLink(r)" :href="waLink(r)" target="_blank" class="action-btn action-btn-wa"><i class="ti ti-brand-whatsapp"></i> Send</a>
                      <span v-else class="pill pill-gray" style="font-size:10px">No WA</span>
                      <button class="action-btn action-btn-call" @click="markSent(r)"><i class="ti ti-check"></i> Sent</button>
                      <button class="action-btn" style="border-color:var(--border-mid);color:var(--text-muted)" @click="markSkipped(r)">Skip</button>
                    </div>
                  </div>
                  <div class="row-more" v-if="qReminders.length>5">
                    <button style="background:none;border:none;font-size:12px;color:var(--teal-mid);cursor:pointer" @click="showAllR=!showAllR">
                      {{ showAllR ? 'Show less' : '+ '+(qReminders.length-5)+' more' }}
                    </button>
                  </div>
                </div>
              </template>
              <!-- Missed -->
              <template v-if="qMissed.length">
                <div class="section-header">
                  <div class="section-title"><i class="ti ti-phone" style="color:var(--amber-mid)"></i> Missed follow-ups</div>
                  <div class="section-count">{{ qMissed.length }} patients</div>
                </div>
                <div class="card-list" style="margin-bottom:18px">
                  <div class="card-list-row" v-for="fc in visibleM" :key="fc.id">
                    <div class="avatar avatar-sm avatar-amber">{{ initials(fc.patientName) }}</div>
                    <div class="row-info"><div class="row-name">{{ fc.patientName }}</div><div class="row-detail">{{ fc.subType }} \u00b7 was due {{ fmtDate(fc.dueDate) }}</div></div>
                    <span class="pill pill-amber" style="flex-shrink:0">{{ overdueText(fc._daysOver) }}</span>
                    <button class="action-btn action-btn-call" @click="$router.push('/followups/'+fc.id)"><i class="ti ti-arrow-right"></i> View</button>
                  </div>
                  <div class="row-more" v-if="qMissed.length>5">
                    <button style="background:none;border:none;font-size:12px;color:var(--teal-mid);cursor:pointer" @click="showAllM=!showAllM">
                      {{ showAllM ? 'Show less' : '+ '+(qMissed.length-5)+' more' }}
                    </button>
                  </div>
                </div>
              </template>
              <!-- High-risk -->
              <template v-if="qHighRisk.length">
                <div class="section-header">
                  <div class="section-title"><i class="ti ti-alert-triangle" style="color:var(--red-mid)"></i> High-risk overdue</div>
                  <div class="section-count">{{ qHighRisk.length }} patients \u00b7 7+ days</div>
                </div>
                <div class="card-list">
                  <div class="card-list-row" v-for="fc in qHighRisk" :key="fc.id">
                    <div class="avatar avatar-sm avatar-red">{{ initials(fc.patientName) }}</div>
                    <div class="q-patient">
                      <div class="q-name">{{ fc.patientName }}</div>
                      <div class="q-sub">{{ fc.subType }}</div>
                    </div>
                    <div class="q-meta">
                      <span class="pill pill-red">{{ overdueText(fc._daysOver) }}</span>
                      <span class="q-due">was due {{ fmtDate(fc.dueDate) }}</span>
                    </div>
                    <div class="q-actions">
                      <button class="action-btn action-btn-flag" @click="$router.push('/followups/'+fc.id)"><i class="ti ti-flag"></i> Escalate</button>
                    </div>
                  </div>
                </div>
              </template>
            </template>
          </template>
        </template>

        <!-- ═══ CASES VIEW ═══ -->
        <template v-if="view==='cases'">
          <div class="search-wrap" style="margin-bottom:10px">
            <i class="ti ti-search"></i>
            <input type="text" v-model="query" class="search-input" placeholder="Search by patient name or ID\u2026" />
            <button class="search-clear" v-if="query" @click="query=''"><i class="ti ti-x"></i></button>
          </div>
          <div class="filter-bar" style="margin-bottom:12px">
            <button class="filter-btn" :class="{on:filterStatus==='all'}"       @click="filterStatus='all'">All</button>
            <button class="filter-btn" :class="{on:filterStatus==='active'}"    @click="filterStatus='active'">Active</button>
            <button class="filter-btn" :class="{on:filterStatus==='completed'}" @click="filterStatus='completed'">Completed</button>
            <span style="width:1px;background:var(--border);margin:0 6px;align-self:stretch"></span>
            <button class="filter-btn" :class="{on:filterType==='all'}"             @click="filterType='all'">All types</button>
            <button class="filter-btn" :class="{on:filterType==='anc'}"             @click="filterType='anc'">ANC</button>
            <button class="filter-btn" :class="{on:filterType==='vaccination'}"     @click="filterType='vaccination'">Vaccine</button>
            <button class="filter-btn" :class="{on:filterType==='post_procedure'}"  @click="filterType='post_procedure'">Post-op</button>
            <button class="filter-btn" :class="{on:filterType==='annual_recall'}"   @click="filterType='annual_recall'">Recall</button>
          </div>
          <div class="loading-wrap" v-if="casesLoading"><i class="ti ti-loader spin"></i></div>
          <div class="empty-section" v-else-if="casesError"><i class="ti ti-alert-triangle"></i><p>{{ casesError }}</p></div>
          <template v-else>
            <p class="results-meta">{{ filteredCases.length }} case{{ filteredCases.length===1?'':'s' }}<span v-if="overdueCnt" style="color:var(--red-mid);margin-left:8px">\u00b7 {{ overdueCnt }} overdue</span></p>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Patient</th><th>Type</th><th>Detail</th><th>Doctor</th><th>Due date</th><th>Status</th><th style="width:40px"></th></tr></thead>
                <tbody>
                  <tr class="trow" v-for="fc in filteredCases" :key="fc.id" @click="$router.push('/followups/'+fc.id)">
                    <td class="td-name">{{ fc.patientName }}<div class="td-muted" style="font-size:11px">{{ fc.patientId }}</div></td>
                    <td><span class="pill" :class="typePill(fc.followupType)" style="font-size:10px">{{ typeTxt(fc.followupType) }}</span></td>
                    <td class="td-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ fc.subType||'\u2014' }}</td>
                    <td class="td-muted">{{ fc.doctorName||'\u2014' }}</td>
                    <td :style="dueCls(fc)">{{ fmtDate(fc.dueDate) }}</td>
                    <td><span class="pill" :class="statusCls(fc)" style="font-size:10px">{{ statusTxt(fc) }}</span></td>
                    <td><i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:13px"></i></td>
                  </tr>
                  <tr v-if="filteredCases.length===0"><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No cases match your filters</td></tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

      </div>
    </div>
  `
};


const Encounter = {
  name: 'Encounter',
  data() {
    return {
      patient: null, loadingPatient: false,
      activeFollowups: [], selectedFollowupIds: [],
      form: { date: todayIso(), doctorName: '', notes: '', diagnosis: '' },
      doctors: CLINIC_DOCTORS.slice(),
      saving: false, errors: {}
    };
  },
  methods: {
    async loadPatient(id) {
      this.loadingPatient = true;
      try {
        this.patient = await getPatient(id);
        if (this.patient) {
          const followups = await getPatientFollowups(this.patient.id);
          this.activeFollowups = followups.filter(f => f.status === 'active');
          if (this.patient.type === 'child') this.form.doctorName = 'Dr. Abhishek Bansal';
        }
      } finally { this.loadingPatient = false; }
    },
    toggleFollowup(id) {
      this.selectedFollowupIds = this.selectedFollowupIds.includes(id)
        ? this.selectedFollowupIds.filter(x => x !== id)
        : [...this.selectedFollowupIds, id];
    },
    validate() {
      this.errors = {};
      if (!this.form.date)       this.errors.date   = 'Date is required';
      if (!this.form.doctorName) this.errors.doctor = 'Please select a doctor';
      return !Object.keys(this.errors).length;
    },
    async save() {
      if (!this.validate()) return;
      this.saving = true;
      try {
        await createEncounter({
          patientDocId:         this.patient.id,
          patientName:          this.patient.name,
          patientId:            this.patient.patientId,
          date:                 this.form.date,
          doctorName:           this.form.doctorName,
          notes:                this.form.notes,
          diagnosis:            this.form.diagnosis,
          completedFollowupIds: this.selectedFollowupIds
        });
        this.$router.push('/followups/new?patientId=' + this.patient.id);
      } catch(e) { alert('Error saving encounter. Please try again.'); }
      finally { this.saving = false; }
    },
    initials(name)  { return patientInitials(name); },
    avCls(name)     { return patientAvatarClass(name); },
    fmtDate(d)      { return fmtDateShort(d); },
    fcBadge_(fc)    { return fcBadge(fc); }
  },
  mounted() {
    if (this.$route.query.patientId) this.loadPatient(this.$route.query.patientId);
  },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="patient?$router.push('/patients/'+patient.id):$router.go(-1)">
              <i class="ti ti-arrow-left"></i> {{ patient?patient.name:'Back' }}
            </button>
            <span class="sep">/</span><span class="current">New encounter</span>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="loading-wrap" v-if="loadingPatient"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="form-card" style="max-width:640px" v-else>
          <div class="form-card-title">Record visit</div>

          <div class="patient-banner" v-if="patient">
            <div class="avatar avatar-md" :class="patient.type==='child'?'avatar-blue':avCls(patient.name)">{{ initials(patient.name) }}</div>
            <div>
              <div class="patient-banner-name">{{ patient.name }}</div>
              <div class="patient-banner-id">{{ patient.patientId }}<template v-if="patient.type==='child'"> &middot; Child</template></div>
            </div>
          </div>

          <p class="form-section-title">Visit details</p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date <span class="form-required">*</span></label>
              <input type="date" v-model="form.date" class="form-input" :class="{'input-error':errors.date}" />
              <p class="form-error" v-if="errors.date">{{ errors.date }}</p>
            </div>
            <div class="form-group">
              <label class="form-label">Doctor <span class="form-required">*</span></label>
              <select v-model="form.doctorName" class="form-select" :class="{'input-error':errors.doctor}">
                <option value="">Select doctor</option>
                <option v-for="d in doctors" :key="d" :value="d">{{ d }}</option>
              </select>
              <p class="form-error" v-if="errors.doctor">{{ errors.doctor }}</p>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea v-model="form.notes" class="form-input" rows="3" placeholder="Examination findings, treatment, prescriptions\u2026" style="resize:vertical"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Diagnosis</label>
            <input type="text" v-model="form.diagnosis" class="form-input" placeholder="Optional" />
          </div>

          <template v-if="activeFollowups.length > 0">
            <p class="form-section-title">Mark follow-ups complete</p>
            <p class="form-hint">Tick any follow-up cases addressed during this visit. Their pending reminders will be cancelled.</p>
            <div class="followup-check-list">
              <div class="followup-check-row" v-for="fc in activeFollowups" :key="fc.id" @click="toggleFollowup(fc.id)">
                <div class="fc-check-box" :class="{checked: selectedFollowupIds.includes(fc.id)}">
                  <i class="ti ti-check" v-if="selectedFollowupIds.includes(fc.id)"></i>
                </div>
                <div style="flex:1">
                  <div class="fc-check-name">{{ fc.subType }}</div>
                  <div class="fc-check-meta">Due {{ fmtDate(fc.dueDate) }}</div>
                </div>
                <span class="fc-badge" :class="fcBadge_(fc).cls" style="font-size:10px">{{ fcBadge_(fc).text }}</span>
              </div>
            </div>
          </template>

          <div class="form-actions">
            <button class="btn btn-primary" @click="save" :disabled="saving||!patient">
              <i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-check" v-else></i>
              {{ saving ? 'Saving\u2026' : 'Save & create follow-up' }}
            </button>
            <button class="btn btn-secondary" @click="patient?$router.push('/patients/'+patient.id):$router.go(-1)" :disabled="saving">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};

// ================================================================
//  STEP 10: BILLING SCREENS
// ================================================================

const BillingList = {
  name: 'BillingList',
  data() { return { invoices:[], loading:true, loadError:null }; },
  methods: {
    async load() {
      this.loading=true; this.loadError=null;
      try { this.invoices=await getRecentInvoices(30); }
      catch(e){ this.loadError='Could not load invoices.'; }
      finally { this.loading=false; }
    },
    fmtAmt(n)    { return fmtAmount(n); },
    fmtDate(d)   { return fmtDateShort(d); },
    typeLabel(t) { return INVOICE_TYPE_LABELS[t]||t||'\u2014'; },
    modePill(m)  { return {cash:'pill-teal',upi:'pill-blue',card:'pill-gray',bank_transfer:'pill-amber'}[m]||'pill-gray'; },
    modeLabel(m) { return PAYMENT_MODE_LABELS[m]||m||'\u2014'; },
    printInv(inv){ printInvoice(inv); }
  },
  mounted() { this.load(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i> Dashboard</button><span class="sep">/</span><span class="current">Billing</span></div></div>
        <div class="topbar-right">
          <button class="btn btn-primary" @click="$router.push('/billing/new')"><i class="ti ti-plus"></i> New invoice</button>
        </div>
      </div>
      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="empty-section" v-else-if="loadError"><i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p></div>
        <div class="empty-section" v-else-if="invoices.length===0">
          <i class="ti ti-receipt"></i><p>No invoices yet</p>
          <button class="btn btn-primary" style="margin-top:14px" @click="$router.push('/billing/new')"><i class="ti ti-plus"></i> Create first invoice</button>
        </div>
        <template v-else>
          <p class="results-meta">{{ invoices.length }} invoices</p>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>Invoice</th><th>Patient</th><th>Date</th><th>Type</th><th>Mode</th><th class="td-amt" style="text-align:right">Amount</th><th style="width:80px">Edited</th><th style="width:40px"></th>
              </tr></thead>
              <tbody>
                <tr class="trow" v-for="inv in invoices" :key="inv.id" @click="$router.push('/billing/'+inv.id)">
                  <td class="td-mono">{{ inv.invoiceNumber }}</td>
                  <td class="td-name">{{ inv.patientName }}</td>
                  <td class="td-muted">{{ fmtDate(inv.date) }}</td>
                  <td><span class="pill" style="font-size:10px">{{ typeLabel(inv.invoiceType) }}</span></td>
                  <td><span class="pill" :class="modePill(inv.paymentMode)" style="font-size:10px">{{ modeLabel(inv.paymentMode) }}</span></td>
                  <td class="td-amt">{{ fmtAmt(inv.totalAmount) }}</td>
                  <td><span v-if="inv.hasEdits" class="edit-badge"><i class="ti ti-edit"></i> Edited</span></td>
                  <td><button class="action-btn" @click.stop="printInv(inv)" title="Print"><i class="ti ti-printer"></i></button></td>
                </tr>
              </tbody>
            </table>
          </div>

        </template>
      </div>
    </div>
  `
};

// ----------------------------------------------------------------
const NewInvoice = {
  name: 'NewInvoice',
  data() {
    return {
      patient: null, loadingPatient: false,
      patientQuery: '', patientResults: [], searchingPatients: false,
      masterServices: [],
      form: {
        date: todayIso(),
        invoiceType: 'consultation',
        paymentMode: 'cash',
        notes: '',
        services: [{ masterId:'', description:'', amount:'' }]
      },
      saving: false, errors: {}
    };
  },
  computed: {
    totalAmount() {
      return this.form.services.reduce((s,x) => s+(parseFloat(x.amount)||0), 0);
    }
  },
  methods: {
    async loadPatient(id) {
      this.loadingPatient=true;
      try { this.patient=await getPatient(id); }
      finally { this.loadingPatient=false; }
    },
    async searchPatients() {
      if (!this.patientQuery.trim()) { this.patientResults=[]; return; }
      this.searchingPatients=true;
      try {
        const all=await getAllPatients();
        const q=this.patientQuery.toLowerCase();
        this.patientResults=all.filter(p=>(p.name||'').toLowerCase().includes(q)||(p.mobile||'').includes(q)).slice(0,5);
      } finally { this.searchingPatients=false; }
    },
    selectPatient(p) { this.patient=p; this.patientQuery=''; this.patientResults=[]; },
    addService() { this.form.services.push({ masterId:'', description:'', amount:'' }); },
    pickMasterService(i, serviceId) {
      if (!serviceId) return;
      const svc = this.masterServices.find(s => s.id === serviceId);
      if (svc) {
        this.form.services[i].description = svc.name;
        this.form.services[i].amount      = svc.defaultAmount || '';
      }
    },
    removeService(i) { if(this.form.services.length>1) this.form.services.splice(i,1); },
    validate() {
      this.errors={};
      if (!this.patient) this.errors.patient='Please select a patient';
      if (!this.form.date) this.errors.date='Date is required';
      const valid=this.form.services.filter(s=>s.description.trim()&&parseFloat(s.amount)>0);
      if (!valid.length) this.errors.services='At least one service with amount is required';
      return !Object.keys(this.errors).length;
    },
    async saveInvoice(andPrint) {
      if (!this.validate()) return;
      this.saving=true;
      try {
        const services=this.form.services
          .filter(s=>s.description.trim()&&parseFloat(s.amount)>0)
          .map(s=>({ description:s.description.trim(), amount:parseFloat(s.amount) }));
        const invoice=await createInvoice({
          patientDocId: this.patient.id,
          patientName:  this.patient.name,
          patientId:    this.patient.patientId,
          date:         this.form.date,
          invoiceType:  this.form.invoiceType,
          services,
          totalAmount:  this.totalAmount,
          paymentMode:  this.form.paymentMode,
          notes:        this.form.notes
        });
        if (andPrint) printInvoice(invoice);
        this.$router.push('/billing');
      } catch(e){ alert('Error saving invoice.'); }
      finally { this.saving=false; }
    },
    fmtAmt(n)     { return fmtAmount(n); },
    initials(n)   { return patientInitials(n); },
    avCls(n)      { return patientAvatarClass(n); }
  },
  mounted() { if (this.$route.query.patientId) this.loadPatient(this.$route.query.patientId);
    getActiveServices().then(s => { this.masterServices = s; }).catch(() => {});
  },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="$router.push('/billing')"><i class="ti ti-arrow-left"></i> Billing</button>
            <span class="sep">/</span><span class="current">New invoice</span>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="loading-wrap" v-if="loadingPatient"><i class="ti ti-loader spin"></i></div>
        <div class="form-card" style="max-width:640px" v-else>
          <div class="form-card-title">New invoice</div>

          <p class="form-section-title">Patient</p>
          <div class="patient-banner" v-if="patient">
            <div class="avatar avatar-md" :class="avCls(patient.name)">{{ initials(patient.name) }}</div>
            <div><div class="patient-banner-name">{{ patient.name }}</div><div class="patient-banner-id">{{ patient.patientId }}</div></div>
            <button class="btn btn-secondary btn-sm" style="margin-left:auto" @click="patient=null">Change</button>
          </div>
          <div v-else>
            <div class="search-wrap">
              <i class="ti ti-search"></i>
              <input type="text" v-model="patientQuery" class="search-input" placeholder="Search patient by name or mobile\u2026" @input="searchPatients" />
            </div>
            <div class="section-card" v-if="patientResults.length">
              <div class="patient-search-result" v-for="p in patientResults" :key="p.id" @click="selectPatient(p)">
                <div class="avatar avatar-sm" :class="avCls(p.name)">{{ initials(p.name) }}</div>
                <div><div style="font-size:13px;font-weight:500">{{ p.name }}</div><div style="font-size:11px;color:var(--text-muted)">{{ p.patientId }} &middot; {{ p.mobile }}</div></div>
              </div>
            </div>
            <p class="form-error" v-if="errors.patient">{{ errors.patient }}</p>
          </div>

          <p class="form-section-title" style="margin-top:16px">Invoice details</p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date <span class="form-required">*</span></label>
              <input type="date" v-model="form.date" class="form-input" :class="{'input-error':errors.date}" />
              <p class="form-error" v-if="errors.date">{{ errors.date }}</p>
            </div>
            <div class="form-group">
              <label class="form-label">Invoice type</label>
              <select v-model="form.invoiceType" class="form-select">
                <option value="consultation">Consultation</option>
                <option value="vaccination">Vaccination</option>
                <option value="procedure">Procedure</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <p class="form-section-title">Services</p>
          <div class="service-row" v-for="(svc,i) in form.services" :key="i">
            <select v-if="masterServices.length" class="service-picker" v-model="svc.masterId" @change="pickMasterService(i, svc.masterId)">
              <option value="">Custom / type below</option>
              <option v-for="ms in masterServices" :key="ms.id" :value="ms.id">{{ ms.name }}</option>
            </select>
            <input type="text" v-model="svc.description" class="form-input" placeholder="Service description" style="flex:1" />
            <div style="position:relative;width:130px">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none">&#8377;</span>
              <input type="number" v-model="svc.amount" class="form-input service-amt-input" placeholder="0" min="0" style="padding-left:24px" />
            </div>
            <button class="service-remove-btn" @click="removeService(i)" v-if="form.services.length>1"><i class="ti ti-x"></i></button>
          </div>
          <button class="btn btn-secondary btn-sm" @click="addService" style="margin-top:4px"><i class="ti ti-plus"></i> Add service</button>
          <p class="form-error" v-if="errors.services" style="margin-top:8px">{{ errors.services }}</p>
          <div class="invoice-total-bar" v-if="totalAmount>0">
            <span class="invoice-total-label">Total</span>
            <span class="invoice-total-value">{{ fmtAmt(totalAmount) }}</span>
          </div>

          <p class="form-section-title">Payment</p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Mode <span class="form-required">*</span></label>
              <select v-model="form.paymentMode" class="form-select">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card / POS</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <input type="text" v-model="form.notes" class="form-input" placeholder="Optional" />
            </div>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" @click="saveInvoice(true)" :disabled="saving||!patient">
              <i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-printer" v-else></i>
              {{ saving ? 'Saving\u2026' : 'Save & Print' }}
            </button>
            <button class="btn btn-secondary" @click="saveInvoice(false)" :disabled="saving||!patient">
              <i class="ti ti-check"></i> Save only
            </button>
            <button class="btn btn-secondary" @click="$router.push('/billing')" :disabled="saving">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};

// ----------------------------------------------------------------

const InvoiceDetail = {
  name: 'InvoiceDetail',
  data() { return { invoice:null, loading:true, loadError:null, editing:false, editForm:{services:[],paymentMode:'cash',notes:''}, editReason:'', edits:[], savingEdit:false }; },
  computed: {
    editTotal() { return this.editForm.services.reduce((s,x)=>s+(parseFloat(x.amount)||0),0); },
    isDoctor()  { return this.$root.role==='doctor'; }
  },
  methods: {
    async load() {
      this.loading=true; this.loadError=null;
      try {
        this.invoice=await getInvoice(this.$route.params.id);
        if (!this.invoice) { this.loadError='Invoice not found.'; return; }
        if (this.invoice.hasEdits) this.edits=await getInvoiceEdits(this.$route.params.id);
      } catch(e) { this.loadError='Could not load invoice.'; }
      finally { this.loading=false; }
    },
    startEdit() {
      this.editForm = {
        services:    JSON.parse(JSON.stringify(this.invoice.services||[])),
        paymentMode: this.invoice.paymentMode,
        notes:       this.invoice.notes||''
      };
      this.editReason=''; this.editing=true;
    },
    cancelEdit() { this.editing=false; },
    async saveEdit() {
      if (!this.editReason.trim()) { alert('Please enter a reason for the edit.'); return; }
      this.savingEdit=true;
      try {
        await editInvoice(this.invoice.id, { services:this.editForm.services, paymentMode:this.editForm.paymentMode, notes:this.editForm.notes, totalAmount:this.editTotal }, this.editReason);
        this.editing=false; await this.load();
      } catch(e) { alert('Error: '+e.message); }
      finally { this.savingEdit=false; }
    },
    print()        { if(this.invoice) printInvoice(this.invoice); },
    fmtAmt(n)      { return fmtAmount(n); },
    fmtDate(d)     { return fmtDateShort(d); },
    modeLabel(m)   { return PAYMENT_MODE_LABELS[m]||m||'\u2014'; },
    typeLabel(t)   { return INVOICE_TYPE_LABELS[t]||t||'\u2014'; },
    fmtTs(ts)      { if(!ts||!ts.toDate) return '\u2014'; return ts.toDate().toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); },
    isSuperUser() { return this.$root.role === 'superuser'; },
    async confirmDeleteInvoice() {
      const reason = prompt('Reason for deleting ' + (this.invoice ? this.invoice.invoiceNumber : 'this invoice') + ':');
      if (!reason || !reason.trim()) return;
      if (!confirm('Permanently delete this invoice? This cannot be undone.')) return;
      try {
        const user = this.$root.user;
        await hardDeleteInvoice(this.invoice, reason, user ? user.email : 'unknown');
        this.$router.push('/billing');
      } catch(e) { alert('Error: ' + e.message); }
    }
  },
  mounted() { this.load(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i></button><span class="sep">/</span>
            <button class="btn btn-secondary btn-sm" @click="$router.push('/billing')"><i class="ti ti-arrow-left"></i> Billing</button>
            <span class="sep">/</span>
            <span class="current">{{ invoice ? invoice.invoiceNumber : 'Invoice' }}</span>
          </div>
        </div>
        <div class="topbar-right" v-if="invoice">
          <button class="btn btn-secondary" @click="print"><i class="ti ti-printer"></i> Print</button>
          <button class="btn btn-secondary" @click="startEdit" v-if="!editing"><i class="ti ti-edit"></i> Edit invoice</button>
          <button class="btn" style="background:#dc2626;color:white;border-color:#dc2626" v-if="isSuperUser() && !editing" @click="confirmDeleteInvoice()"><i class="ti ti-trash"></i> Delete</button>
        </div>
      </div>
      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="empty-section" v-else-if="loadError"><i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p></div>
        <template v-else-if="invoice">
          <div class="invoice-detail-card">
            <div class="invoice-detail-header">
              <div>
                <div class="invoice-detail-no">{{ invoice.invoiceNumber }}</div>
                <div class="invoice-detail-date">{{ fmtDate(invoice.date) }}</div>
              </div>
              <span class="pill pill-teal">{{ modeLabel(invoice.paymentMode) }}</span>
            </div>
            <div class="info-grid" style="padding:14px 16px;border-bottom:1px solid var(--border)">
              <div class="info-item"><div class="info-label">Patient</div><div class="info-value">{{ invoice.patientName }}</div></div>
              <div class="info-item"><div class="info-label">Patient ID</div><div class="info-value">{{ invoice.patientId }}</div></div>
              <div class="info-item"><div class="info-label">Type</div><div class="info-value">{{ typeLabel(invoice.invoiceType) }}</div></div>
              <div class="info-item"><div class="info-label">Status</div><div class="info-value" style="text-transform:capitalize">{{ invoice.paymentStatus }}</div></div>
            </div>
            <div class="invoice-service-row" v-for="(s,i) in invoice.services" :key="i">
              <span>{{ s.description }}</span>
              <span style="font-weight:500">{{ fmtAmt(s.amount) }}</span>
            </div>
            <div class="invoice-total-row">
              <span>Total Amount</span>
              <span class="amount">{{ fmtAmt(invoice.totalAmount) }}</span>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px;padding:0 16px 16px" v-if="invoice.notes">Notes: {{ invoice.notes }}</div>

          <!-- EDIT PANEL -->
          <div class="detail-card" v-if="editing" style="margin-top:16px;border-color:var(--amber-border)">
            <p class="form-section-title" style="margin-top:0;color:var(--amber-mid)"><i class="ti ti-edit"></i> Edit invoice</p>
            <div v-for="(svc,i) in editForm.services" :key="i" class="service-row" style="margin-bottom:8px">
              <input type="text" v-model="svc.description" class="form-input" style="flex:1" />
              <div style="display:flex;align-items:center;gap:4px;border:1px solid var(--border-mid);border-radius:8px;padding:0 10px;flex-shrink:0">
                <span style="font-size:12px;color:var(--text-muted)">&#8377;</span>
                <input type="number" v-model="svc.amount" style="border:none;width:80px;font-size:13px;outline:none;background:transparent" />
              </div>
            </div>
            <div class="form-row" style="margin-top:10px">
              <div class="form-group">
                <label class="form-label">Payment mode</label>
                <select v-model="editForm.paymentMode" class="form-select">
                  <option value="cash">Cash</option><option value="upi">UPI</option>
                  <option value="card">Card / POS</option><option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Notes</label>
                <input type="text" v-model="editForm.notes" class="form-input" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Reason for edit <span class="form-required">*</span></label>
              <input type="text" v-model="editReason" class="form-input" placeholder="e.g. Corrected service amount, wrong mode selected" />
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
              <div style="font-size:13px;font-weight:600">Revised total: {{ fmtAmt(editTotal) }}</div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" @click="cancelEdit">Cancel</button>
                <button class="btn btn-primary" @click="saveEdit" :disabled="savingEdit||!editReason.trim()">
                  <i class="ti ti-check"></i> {{ savingEdit ? 'Saving…' : 'Save edit' }}
                </button>
              </div>
            </div>
          </div>

          <!-- EDIT HISTORY -->
          <div v-if="edits && edits.length" style="margin-top:16px">
            <div class="section-header"><div class="section-title"><span class="edit-badge"><i class="ti ti-edit"></i> Edit history</span></div></div>
            <div class="section-card">
              <div class="edit-history-row" v-for="e in edits" :key="e.id">
                <div class="edit-meta">{{ fmtTs(e.editedAt) }} · {{ e.editedBy }}</div>
                <div class="edit-reason">{{ e.reason }}</div>
                <div style="margin-top:4px;color:var(--text-muted);font-size:11px">{{ fmtAmt(e.before.totalAmount) }} → {{ fmtAmt(e.after.totalAmount) }}</div>
              </div>
            </div>
          </div>

        </template>
      </div>
    </div>
  `
};

// ================================================================
//  STEP 11: DAILY RECONCILIATION
// ================================================================

const Reconciliation = {
  name: 'Reconciliation',
  data() {
    return {
      date: todayIso(),
      systemTotals: { cash:0, upi:0, card:0, bank_transfer:0 },
      actual: { cash:'', upi:'', card:'', bank_transfer:'' },
      isReconciled: false, notes: '',
      loading: true, saving: false,
      modes: [
        { key:'cash',          label:'Cash' },
        { key:'upi',           label:'UPI' },
        { key:'card',          label:'Card / POS' },
        { key:'bank_transfer', label:'Bank Transfer' }
      ]
    };
  },
  computed: {
    totalSystem()  { return Object.values(this.systemTotals).reduce((a,b)=>a+b, 0); },
    totalActual()  { return Object.values(this.actual).reduce((s,v)=>s+(parseFloat(v)||0), 0); },
    totalDiff()    { return this.totalSystem - this.totalActual; },
    dateLabel()    { return fmtDateShort(this.date); },
    isToday()      { return this.date === todayIso(); }
  },
  methods: {
    async loadData() {
      this.loading=true;
      try {
        const [totals, recon] = await Promise.all([
          getDailySystemTotals(this.date),
          getReconciliation(this.date)
        ]);
        this.systemTotals=totals;
        if (recon) {
          const a=recon.actual||{};
          this.actual={ cash:a.cash||'', upi:a.upi||'', card:a.card||'', bank_transfer:a.bank_transfer||'' };
          this.isReconciled=!!recon.isReconciled;
          this.notes=recon.notes||'';
        } else {
          this.actual={ cash:'', upi:'', card:'', bank_transfer:'' };
          this.isReconciled=false; this.notes='';
        }
      } finally { this.loading=false; }
    },
    prevDay()  { this.date=addDays(this.date,-1); this.loadData(); },
    nextDay()  { this.date=addDays(this.date,1);  this.loadData(); },
    goToday()  { this.date=todayIso(); this.loadData(); },
    diff(mode) { return (this.systemTotals[mode]||0)-(parseFloat(this.actual[mode])||0); },
    diffCls(d) { return d===0?'diff-green':d>0?'diff-red':'diff-amber'; },
    diffText(d){ return d===0?'\u2714 Match':(d>0?'\u2212 '+fmtAmount(d):'+'+fmtAmount(Math.abs(d))); },
    async save() {
      this.saving=true;
      try {
        const a={};
        Object.keys(this.actual).forEach(k=>a[k]=parseFloat(this.actual[k])||0);
        await saveReconciliation(this.date,a,this.notes);
        alert('Collections saved.');
      } catch(e){ alert('Error saving.'); }
      finally { this.saving=false; }
    },
    async reconcile() {
      this.saving=true;
      try {
        const a={};
        Object.keys(this.actual).forEach(k=>a[k]=parseFloat(this.actual[k])||0);
        await markReconciled(this.date,a,this.notes);
        this.isReconciled=true;
      } catch(e){ alert('Error.'); }
      finally { this.saving=false; }
    },
    fmtAmt(n) { return fmtAmount(n); }
  },
  mounted() { this.loadData(); },
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-home"></i> Dashboard</button><span class="sep">/</span><span class="current">Reconciliation</span></div></div></div>
      <div class="content">
        <div class="date-nav">
          <button class="date-nav-btn" @click="prevDay"><i class="ti ti-chevron-left"></i></button>
          <div class="date-nav-label">{{ dateLabel }}</div>
          <button class="date-nav-btn" @click="nextDay"><i class="ti ti-chevron-right"></i></button>
          <button class="btn btn-secondary btn-sm" @click="goToday" v-if="!isToday">Today</button>
        </div>

        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>

        <template v-else>
          <div :class="isReconciled?'recon-status done':'recon-status pending'">
            <i :class="isReconciled?'ti ti-circle-check':'ti ti-clock'"></i>
            {{ isReconciled ? 'Reconciled' : 'Not reconciled' }}
          </div>

          <div class="recon-table">
            <div class="recon-row header">
              <div>Mode</div><div>System total</div><div>Actual collected</div><div>Diff</div>
            </div>
            <div class="recon-row" v-for="m in modes" :key="m.key">
              <div class="recon-mode">{{ m.label }}</div>
              <div class="recon-sys">{{ fmtAmt(systemTotals[m.key]||0) }}</div>
              <input type="number" v-model="actual[m.key]" class="recon-input" placeholder="0" :disabled="isReconciled" />
              <div :class="diffCls(diff(m.key))">{{ diffText(diff(m.key)) }}</div>
            </div>
            <div class="recon-row total-row">
              <div>Total</div>
              <div>{{ fmtAmt(totalSystem) }}</div>
              <div>{{ fmtAmt(totalActual) }}</div>
              <div :class="diffCls(totalDiff)">{{ diffText(totalDiff) }}</div>
            </div>
          </div>

          <div class="form-group" v-if="!isReconciled">
            <label class="form-label">Notes</label>
            <textarea v-model="notes" class="form-input" rows="2" placeholder="Optional notes for this day"></textarea>
          </div>

          <div class="form-actions" v-if="!isReconciled">
            <button class="btn btn-primary" @click="reconcile" :disabled="saving">
              <i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-circle-check" v-else></i>
              {{ saving ? 'Saving\u2026' : 'Mark as reconciled' }}
            </button>
            <button class="btn btn-secondary" @click="save" :disabled="saving">Save collections</button>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px" v-if="isReconciled">
            This day has been marked as reconciled. Contact admin to make changes.
          </p>
        </template>
      </div>
    </div>
  `
};

// ================================================================
//  ROUTER
// ================================================================

// ================================================================
//  AUDIT LOG SCREEN (superuser only)
// ================================================================
const Analytics = {
  name: 'Analytics',
  data() {
    return {
      period: 30,
      summary: null, modeData: null, trendData: [], followupStats: null,
      loading: true
    };
  },
  computed: {
    hasModeData() {
      return this.modeData && Object.values(this.modeData).some(v => v > 0);
    }
  },
  methods: {
    async loadData() {
      this.loading = true;
      if (this._chartRevenue) { this._chartRevenue.destroy(); this._chartRevenue = null; }
      if (this._chartMode)    { this._chartMode.destroy();    this._chartMode    = null; }
      try {
        const [summary, modeData, trendData, followupStats] = await Promise.all([
          getRevenueSummary(), getRevenueByMode(this.period),
          getDailyRevenueTrend(this.period), getFollowupStats()
        ]);
        this.summary = summary; this.modeData = modeData;
        this.trendData = trendData; this.followupStats = followupStats;
        this.$nextTick(() => { this.initCharts(); });
      } finally { this.loading = false; }
    },
    initCharts() {
      const ctx1 = this.$refs.chartRevenue;
      if (ctx1 && this.trendData.length) {
        this._chartRevenue = new Chart(ctx1, {
          type: 'line',
          data: {
            labels: this.trendData.map(d => {
              const [y,m,dy] = d.date.split('-').map(Number);
              return new Date(y,m-1,dy).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
            }),
            datasets: [{ label: 'Revenue', data: this.trendData.map(d=>d.amount),
              borderColor: '#0F6E56', backgroundColor: 'rgba(15,110,86,0.08)',
              fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 5 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { callback: v => '\u20b9'+v.toLocaleString('en-IN') } },
              x: { ticks: { maxTicksLimit: 10, maxRotation: 0 } }
            }
          }
        });
      }
      const ctx2 = this.$refs.chartMode;
      if (ctx2 && this.hasModeData) {
        this._chartMode = new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: ['Cash','UPI','Card / POS','Bank Transfer'],
            datasets: [{ data: [this.modeData.cash,this.modeData.upi,this.modeData.card,this.modeData.bank_transfer],
              backgroundColor: ['#0F6E56','#185FA5','#666','#BA7517'],
              borderWidth: 2, borderColor: '#fff' }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position:'bottom', labels:{ font:{size:12}, padding:12 } } }
          }
        });
      }
    },
    setPeriod(p) { this.period=p; this.loadData(); },
    fmtAmt(n) { return fmtAmount(n); }
  },
  mounted() { this.loadData(); },
  beforeUnmount() {
    if (this._chartRevenue) this._chartRevenue.destroy();
    if (this._chartMode)    this._chartMode.destroy();
  },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/dashboard')"><i class="ti ti-arrow-left"></i> Home</button>
            <span class="sep">/</span><span class="current">Reports</span>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <template v-else>
          <div class="analytics-grid" v-if="summary">
            <div class="analytics-card analytics-teal"><div class="analytics-label">Today</div><div class="analytics-value">{{ fmtAmt(summary.todayTotal) }}</div></div>
            <div class="analytics-card"><div class="analytics-label">This week</div><div class="analytics-value">{{ fmtAmt(summary.weekTotal) }}</div></div>
            <div class="analytics-card"><div class="analytics-label">This month</div><div class="analytics-value">{{ fmtAmt(summary.monthTotal) }}</div></div>
            <div class="analytics-card"><div class="analytics-label">Total invoices</div><div class="analytics-value">{{ summary.invoiceCount }}</div><div class="analytics-sub">Avg {{ fmtAmt(summary.avgInvoice) }} each</div></div>
          </div>
          <div class="period-selector">
            <button class="period-btn" :class="{on:period===7}"  @click="setPeriod(7)">7 days</button>
            <button class="period-btn" :class="{on:period===30}" @click="setPeriod(30)">30 days</button>
            <button class="period-btn" :class="{on:period===90}" @click="setPeriod(90)">90 days</button>
          </div>
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
            <div class="chart-card">
              <div class="chart-title">Revenue trend</div>
              <div class="chart-wrap"><canvas ref="chartRevenue"></canvas></div>
            </div>
            <div class="chart-card">
              <div class="chart-title">Collections by mode</div>
              <div class="chart-wrap" v-if="hasModeData"><canvas ref="chartMode"></canvas></div>
              <div class="empty-section" v-else style="padding:40px 0"><i class="ti ti-chart-pie"></i><p>No data yet</p></div>
            </div>
          </div>
          <div class="chart-card" v-if="followupStats">
            <div class="chart-title">Follow-up compliance</div>
            <div class="compliance-row"><span>Total cases</span><strong>{{ followupStats.total }}</strong></div>
            <div class="compliance-row">
              <div style="flex:1"><div style="color:var(--teal-mid);font-weight:500">Completed \u2014 {{ followupStats.complianceRate }}%</div>
              <div class="compliance-bar-bg"><div class="compliance-bar" :style="{width:followupStats.complianceRate+'%',background:'var(--teal-mid)'}"></div></div></div>
              <strong style="color:var(--teal-mid);margin-left:16px">{{ followupStats.completed }}</strong>
            </div>
            <div class="compliance-row">
              <div style="flex:1"><div style="color:var(--amber-mid);font-weight:500">Overdue \u2014 {{ followupStats.overdueRate }}% of active</div>
              <div class="compliance-bar-bg"><div class="compliance-bar" :style="{width:followupStats.overdueRate+'%',background:'var(--amber-mid)'}"></div></div></div>
              <strong style="color:var(--amber-mid);margin-left:16px">{{ followupStats.overdue }}</strong>
            </div>
            <div class="compliance-row"><span>Active (on track)</span><span>{{ followupStats.active - followupStats.overdue }}</span></div>
            <div class="compliance-row"><span style="color:var(--text-muted)">Declined</span><span style="color:var(--text-muted)">{{ followupStats.declined }}</span></div>
          </div>
        </template>
      </div>
    </div>
  `
};


const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path:'/',                   redirect:'/dashboard' },
    { path:'/dashboard',          component:Dashboard },
    { path:'/appointments',        component:Appointments },
    { path:'/appointments/new',   component:NewAppointment },
    { path:'/patients',           component:PatientSearch },
    { path:'/patients/new',       component:NewPatient },
    { path:'/patients/:id',       component:PatientProfile },
    { path:'/patients/:id/edit',  component:PatientEdit },
    { path:'/patients/:id/child', component:ChildRegistration },
    { path:'/followups',          component:FollowupList },
    { path:'/followups/new',      component:FollowupCreation },
    { path:'/followups/:id',      component:FollowupDetail },
    { path:'/encounters/new',     component:Encounter },
    { path:'/billing',            component:BillingList },
    { path:'/billing/new',        component:NewInvoice },
    { path:'/billing/:id',        component:InvoiceDetail },
    { path:'/reconciliation',     component:Reconciliation },
    { path:'/analytics',            component:Analytics },
    { path:'/config',               component:Config },
  ]
});

router.beforeEach((to, from, next) => {
  const doctorOnly = ['/analytics', '/reconciliation', '/config'];
  if (doctorOnly.some(p => to.path.startsWith(p)) && window._appRole !== 'doctor' && window._appRole !== 'superuser') {
    next('/dashboard');
  } else {
    next();
  }
});

// ================================================================
//  ROOT APP
// ================================================================

const App = {
  name: 'App',
  components: { Login },
  data() { return { user:null, role:null, userName:null, authChecked:false, whitelistError:false, showProfileMenu:false }; },
  computed: {
    section() {
      const p=this.$route.path;
      if (p.startsWith('/patients'))       return 'patients';
      if (p.startsWith('/followups'))      return 'followups';
      if (p.startsWith('/billing'))        return 'billing';
      if (p.startsWith('/reconciliation')) return 'reconciliation';
      if (p.startsWith('/analytics'))      return 'analytics';
      if (p.startsWith('/config'))         return 'config';
      if (p.startsWith('/dashboard'))      return 'dashboard';
      if (p.startsWith('/appointments'))   return 'appointments';
      return 'dashboard';
    },
    userInitials() {
      if (!this.user||!this.user.displayName) return '?';
      return this.user.displayName.trim().split(/\s+/).slice(0,2).map(n=>n[0].toUpperCase()).join('');
    }
  },
  methods: { async signOut() { await signOutUser(); } },
  watch: { '$route'() { this.showProfileMenu = false; } },
  mounted() {
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        const access = await checkUserAccess(user.email);
        if (!access) {
          await signOutUser();
          this.whitelistError = true;
          this.user = null;
        } else {
          this.user     = user;
          this.role     = access.role;
          this.userName = access.name || user.displayName || user.email;
          window._appRole = access.role;
          this.whitelistError = false;
        }
      } else {
        this.user = null; this.role = null; this.userName = null;
        window._appRole = null;
      }
      this.authChecked = true;
    });
  },
  template: `
    <div>
      <div class="auth-loading" v-if="!authChecked"><i class="ti ti-loader spin" style="font-size:28px;color:var(--teal-mid)"></i></div>
      <Login v-else-if="!user" :whitelist-error="whitelistError" />
      <div class="layout" v-else>
        <div class="main-area">

          <!-- Persistent app topbar -->
          <div class="app-topbar">
            <div class="app-brand" @click="$router.push('/dashboard')" style="cursor:pointer">
              <div class="app-brand-mark">A</div>
              <span class="app-brand-name">Aangan Clinic</span>
            </div>
            <div class="app-topbar-right">
              <div class="profile-chip" @click.stop="showProfileMenu = !showProfileMenu">
                <img v-if="user.photoURL" :src="user.photoURL" class="profile-ava" referrerpolicy="no-referrer" />
                <div v-else class="profile-ava">{{ userInitials }}</div>
                <span class="profile-chip-name">{{ userName||user.displayName||'Staff' }}</span>
                <i class="ti ti-chevron-down" style="font-size:10px;color:var(--text-muted);margin-left:2px"></i>
              </div>
            </div>
          </div>

          <!-- Profile menu -->
          <template v-if="showProfileMenu">
            <div class="profile-overlay" @click="showProfileMenu=false"></div>
            <div class="profile-menu">
              <div class="profile-menu-header">
                <div class="profile-menu-name">{{ userName||user.displayName||'Staff' }}</div>
                <div class="profile-menu-email">{{ user.email }}</div>
                <span class="role-badge" :class="'role-'+(role||'staff')" style="margin-top:4px">{{ role==='doctor'?'Doctor':'Staff' }}</span>
              </div>
              <div class="profile-menu-divider"></div>
              <button class="profile-menu-item" v-if="role==='doctor'||role==='superuser'" @click="showProfileMenu=false; $router.push('/analytics')"><i class="ti ti-chart-line"></i> Reports</button>
              <button class="profile-menu-item" v-if="role==='doctor'||role==='superuser'" @click="showProfileMenu=false; $router.push('/config')"><i class="ti ti-settings"></i> Settings</button>
              <button class="profile-menu-item" v-if="role==='doctor'||role==='superuser'" @click="showProfileMenu=false; $router.push('/reconciliation')"><i class="ti ti-chart-bar"></i> Reconciliation</button>
              <div class="profile-menu-divider" v-if="role==='doctor'||role==='superuser'"></div>
              <button class="profile-menu-item red" @click="signOut"><i class="ti ti-logout"></i> Sign out</button>
            </div>
          </template>

          <router-view></router-view>
        </div>
      </div>
    </div>
  `
};

const app = createApp(App);
app.use(router);
app.mount('#app');
