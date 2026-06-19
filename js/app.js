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
        <div class="topbar-left"><h1>Patients</h1></div>
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
          <div class="pt-card" v-for="p in filteredPatients" :key="p.id" @click="$router.push('/patients/'+p.id)">
            <div class="avatar avatar-md" :class="p.type==='child'?'avatar-blue':avatarClass(p.name)">{{ initials(p.name) }}</div>
            <div class="pt-info">
              <div class="pt-name">{{ p.name }}</div>
              <div class="pt-meta">{{ p.patientId }}<template v-if="age(p.dob)"> &middot; {{ age(p.dob) }}</template> &middot; {{ p.mobile||p.motherName }}</div>
            </div>
            <div class="pt-right"><span class="pill pill-blue" v-if="p.type==='child'">Child</span><span class="pill pill-teal" v-else>Adult</span></div>
            <i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:15px;flex-shrink:0"></i>
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
        <div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/patients')"><i class="ti ti-arrow-left"></i> Patients</button><span class="sep">/</span><span class="current">New patient</span></div></div>
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
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/patients/'+$route.params.id)"><i class="ti ti-arrow-left"></i> Patient</button><span class="sep">/</span><span class="current">Edit</span></div></div></div>
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
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/patients/'+$route.params.id)"><i class="ti ti-arrow-left"></i> {{ mother?mother.name:'Patient' }}</button><span class="sep">/</span><span class="current">Register child</span></div></div></div>
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
  data() { return { patient:null, loading:true, loadError:null, children:[], mother:null, followups:[], encounters:[], showAllFollowups:false }; },
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
    fmtEncDate(d) { return fmtDateShort(d); }
  },
  mounted() { this.loadPatient(); },
  watch: { '$route.params.id'() { this.loadPatient(); } },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
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

const WorkQueue = {
  name: 'WorkQueue',
  data() {
    return {
      loading: true, loadError: null,
      reminders: [], missed: [], highRisk: [],
      lastRefreshed: null,
      showAllReminders: false, showAllMissed: false
    };
  },
  computed: {
    todayLabel() {
      return new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    },
    totalTasks()       { return this.reminders.length + this.missed.length + this.highRisk.length; },
    visibleReminders() { return this.showAllReminders ? this.reminders : this.reminders.slice(0, 5); },
    visibleMissed()    { return this.showAllMissed    ? this.missed    : this.missed.slice(0, 5); }
  },
  methods: {
    async loadQueue() {
      this.loading = true; this.loadError = null;
      try {
        const [reminders, allMissed] = await Promise.all([
          getTodaysPendingReminders(),
          getMissedFollowups()
        ]);
        this.reminders = reminders;
        const withDays = allMissed.map(fc => ({ ...fc, _daysOver: this.daysOver(fc.dueDate) }));
        this.missed    = withDays.filter(fc => fc._daysOver < 7);
        this.highRisk  = withDays.filter(fc => fc._daysOver >= 7)
                                 .sort((a, b) => b._daysOver - a._daysOver);
        this.lastRefreshed = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
      } catch(e) {
        this.loadError = 'Could not load work queue. Check your connection.';
      } finally { this.loading = false; }
    },
    async markSent(reminder) {
      try {
        await updateReminderStatus(reminder.id, 'sent');
        this.reminders = this.reminders.filter(r => r.id !== reminder.id);
      } catch(e) { alert('Error marking as sent.'); }
    },
    async markSkipped(reminder) {
      try {
        await updateReminderStatus(reminder.id, 'skipped');
        this.reminders = this.reminders.filter(r => r.id !== reminder.id);
      } catch(e) { alert('Error.'); }
    },
    daysOver(dueDate) {
      if (!dueDate) return 0;
      const [y1,m1,d1] = todayIso().split('-').map(Number);
      const [y2,m2,d2] = dueDate.split('-').map(Number);
      return Math.max(0, Math.floor(
        (new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2)) / 86400000
      ));
    },
    waLink(r)          { return buildReminderWaLink(r); },
    initials(name)     { return patientInitials(name); },
    avCls(name, risk)  {
      if (risk === 'high')   return 'avatar-red';
      if (risk === 'missed') return 'avatar-amber';
      return patientAvatarClass(name);
    },
    fmtDate(d)         { return fmtDateShort(d); },
    typePillText(t)    {
      return { anc:'ANC', vaccination:'Vaccine', post_procedure:'Post-op', annual_recall:'Recall' }[t] || 'Follow-up';
    },
    typePillCls(t)     {
      return { anc:'pill-teal', vaccination:'pill-blue', post_procedure:'pill-gray', annual_recall:'pill-gray' }[t] || 'pill-gray';
    },
    overdueText(d)     { return d === 1 ? '1 day over' : d + ' days over'; }
  },
  mounted() { this.loadQueue(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <h1>Today\u2019s work queue</h1>
          <p>{{ todayLabel }}</p>
        </div>
        <div class="topbar-right">
          <button class="btn btn-secondary btn-sm" @click="loadQueue" :disabled="loading">
            <i class="ti ti-refresh"></i> Refresh
          </button>
          <button class="btn btn-primary" @click="$router.push('/patients/new')">
            <i class="ti ti-user-plus"></i> New patient
          </button>
        </div>
      </div>

      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading queue\u2026</div>
        <div class="empty-section" v-else-if="loadError">
          <i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p>
          <button class="btn btn-secondary" style="margin-top:14px" @click="loadQueue">Try again</button>
        </div>

        <template v-else>
          <div class="stat-grid">
            <div class="stat-card stat-teal">
              <div class="stat-label">Reminders due</div>
              <div class="stat-value">{{ reminders.length }}</div>
            </div>
            <div class="stat-card stat-amber">
              <div class="stat-label">Missed follow-ups</div>
              <div class="stat-value">{{ missed.length }}</div>
            </div>
            <div class="stat-card stat-red">
              <div class="stat-label">Overdue 7+ days</div>
              <div class="stat-value">{{ highRisk.length }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Last refreshed</div>
              <div class="stat-value" style="font-size:14px;color:var(--text-secondary)">{{ lastRefreshed || '\u2014' }}</div>
            </div>
          </div>

          <div class="empty-section" v-if="totalTasks === 0" style="padding:60px 20px">
            <i class="ti ti-circle-check" style="font-size:40px;color:var(--teal-mid);opacity:.7"></i>
            <h2 style="color:var(--teal-mid);font-size:18px;margin-top:8px">All clear</h2>
            <p>No pending reminders or missed follow-ups for today</p>
          </div>

          <template v-else>

            <template v-if="reminders.length > 0">
              <div class="section-header">
                <div class="section-title">
                  <i class="ti ti-brand-whatsapp" style="color:var(--teal-mid)"></i>
                  Reminders to send
                </div>
                <div class="section-count">{{ reminders.length }} pending</div>
              </div>
              <div class="card-list" style="margin-bottom:18px">
                <div class="card-list-row" v-for="r in visibleReminders" :key="r.id">
                  <div class="avatar avatar-sm" :class="avCls(r.patientName, 'reminder')">{{ initials(r.patientName) }}</div>
                  <div class="row-info">
                    <div class="row-name">{{ r.patientName }}</div>
                    <div class="row-detail">{{ r.subType }} &middot; due {{ fmtDate(r.dueDate) }}</div>
                  </div>
                  <span class="pill" :class="typePillCls(r.followupType)" style="flex-shrink:0">{{ typePillText(r.followupType) }}</span>
                  <a v-if="waLink(r)" :href="waLink(r)" target="_blank" class="action-btn action-btn-wa">
                    <i class="ti ti-brand-whatsapp"></i> Send
                  </a>
                  <span v-else class="pill pill-gray" style="font-size:10px" title="No WA consent or mobile">No WA</span>
                  <button class="action-btn action-btn-call" @click="markSent(r)">
                    <i class="ti ti-check"></i> Sent
                  </button>
                  <button class="action-btn" style="border-color:var(--border-mid);color:var(--text-muted)" @click="markSkipped(r)">
                    Skip
                  </button>
                </div>
                <div class="row-more" v-if="reminders.length > 5">
                  <button style="background:none;border:none;font-size:12px;color:var(--teal-mid);cursor:pointer" @click="showAllReminders=!showAllReminders">
                    {{ showAllReminders ? 'Show less' : '+ ' + (reminders.length - 5) + ' more reminders' }}
                  </button>
                </div>
              </div>
            </template>

            <template v-if="missed.length > 0">
              <div class="section-header">
                <div class="section-title">
                  <i class="ti ti-phone" style="color:var(--amber-mid)"></i>
                  Missed follow-ups \u2014 call today
                </div>
                <div class="section-count">{{ missed.length }} patients</div>
              </div>
              <div class="card-list" style="margin-bottom:18px">
                <div class="card-list-row" v-for="fc in visibleMissed" :key="fc.id">
                  <div class="avatar avatar-sm avatar-amber">{{ initials(fc.patientName) }}</div>
                  <div class="row-info">
                    <div class="row-name">{{ fc.patientName }}</div>
                    <div class="row-detail">{{ fc.subType }} &middot; was due {{ fmtDate(fc.dueDate) }}</div>
                  </div>
                  <span class="pill pill-amber" style="flex-shrink:0">{{ overdueText(fc._daysOver) }}</span>
                  <button class="action-btn action-btn-call" @click="$router.push('/followups/'+fc.id)">
                    <i class="ti ti-arrow-right"></i> View
                  </button>
                </div>
                <div class="row-more" v-if="missed.length > 5">
                  <button style="background:none;border:none;font-size:12px;color:var(--teal-mid);cursor:pointer" @click="showAllMissed=!showAllMissed">
                    {{ showAllMissed ? 'Show less' : '+ ' + (missed.length - 5) + ' more patients' }}
                  </button>
                </div>
              </div>
            </template>

            <template v-if="highRisk.length > 0">
              <div class="section-header">
                <div class="section-title">
                  <i class="ti ti-alert-triangle" style="color:var(--red-mid)"></i>
                  High-risk overdue
                </div>
                <div class="section-count">{{ highRisk.length }} patients &middot; 7+ days</div>
              </div>
              <div class="card-list">
                <div class="card-list-row" v-for="fc in highRisk" :key="fc.id">
                  <div class="avatar avatar-sm avatar-red">{{ initials(fc.patientName) }}</div>
                  <div class="row-info">
                    <div class="row-name">{{ fc.patientName }}</div>
                    <div class="row-detail">{{ fc.subType }} &middot; was due {{ fmtDate(fc.dueDate) }}</div>
                  </div>
                  <span class="pill pill-red" style="flex-shrink:0">{{ overdueText(fc._daysOver) }}</span>
                  <button class="action-btn action-btn-flag" @click="$router.push('/followups/'+fc.id)">
                    <i class="ti ti-flag"></i> Escalate
                  </button>
                </div>
              </div>
            </template>

          </template>
        </template>
      </div>
    </div>
  `
};

const FollowupList = {
  name: 'FollowupList',
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><h1>Follow-ups</h1></div><div class="topbar-right"><button class="btn btn-primary" @click="$router.push('/followups/new')"><i class="ti ti-plus"></i> New follow-up</button></div></div>
      <div class="content"><div class="placeholder-screen"><i class="ti ti-calendar-check"></i><h2>All follow-up cases</h2><p class="sub">Global view across all patients &mdash; coming in Step 8</p><p class="step">Step 8 of the build plan</p></div></div>
    </div>`
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
        <div class="topbar-left"><h1>Billing</h1></div>
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
          <div class="section-card">
            <div class="invoice-row" v-for="inv in invoices" :key="inv.id" @click="$router.push('/billing/'+inv.id)">
              <div class="invoice-no-badge">{{ inv.invoiceNumber }}</div>
              <div class="invoice-info">
                <div class="invoice-patient">{{ inv.patientName }}</div>
                <div class="invoice-meta">{{ fmtDate(inv.date) }} &middot; {{ typeLabel(inv.invoiceType) }}</div>
              </div>
              <span class="pill" :class="modePill(inv.paymentMode)">{{ modeLabel(inv.paymentMode) }}</span>
              <div class="invoice-amount">{{ fmtAmt(inv.totalAmount) }}</div>
              <button class="action-btn action-btn-wa" @click.stop="printInv(inv)" title="Print">
                <i class="ti ti-printer"></i>
              </button>
            </div>
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
      form: {
        date: todayIso(),
        invoiceType: 'consultation',
        paymentMode: 'cash',
        notes: '',
        services: [{ description:'', amount:'' }]
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
    addService() { this.form.services.push({ description:'', amount:'' }); },
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
  mounted() {
    if (this.$route.query.patientId) this.loadPatient(this.$route.query.patientId);
  },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
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
  data() { return { invoice:null, loading:true, loadError:null }; },
  methods: {
    async load() {
      this.loading=true; this.loadError=null;
      try { this.invoice=await getInvoice(this.$route.params.id); if(!this.invoice) this.loadError='Invoice not found.'; }
      catch(e) { this.loadError='Could not load invoice.'; }
      finally { this.loading=false; }
    },
    print()        { if(this.invoice) printInvoice(this.invoice); },
    fmtAmt(n)      { return fmtAmount(n); },
    fmtDate(d)     { return fmtDateShort(d); },
    modeLabel(m)   { return PAYMENT_MODE_LABELS[m]||m||'\u2014'; },
    typeLabel(t)   { return INVOICE_TYPE_LABELS[t]||t||'\u2014'; }
  },
  mounted() { this.load(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/billing')"><i class="ti ti-arrow-left"></i> Billing</button>
            <span class="sep">/</span>
            <span class="current">{{ invoice ? invoice.invoiceNumber : 'Invoice' }}</span>
          </div>
        </div>
        <div class="topbar-right" v-if="invoice">
          <button class="btn btn-primary" @click="print"><i class="ti ti-printer"></i> Print</button>
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
          <div style="font-size:12px;color:var(--text-muted)" v-if="invoice.notes">Notes: {{ invoice.notes }}</div>
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
      <div class="topbar"><div class="topbar-left"><h1>Daily reconciliation</h1></div></div>
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

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path:'/',                   redirect:'/queue' },
    { path:'/queue',              component:WorkQueue },
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
  ]
});

// ================================================================
//  ROOT APP
// ================================================================

const App = {
  name: 'App',
  components: { Login },
  data() { return { user:null, authChecked:false, whitelistError:false }; },
  computed: {
    section() {
      const p=this.$route.path;
      if (p.startsWith('/patients'))       return 'patients';
      if (p.startsWith('/followups'))      return 'followups';
      if (p.startsWith('/billing'))        return 'billing';
      if (p.startsWith('/reconciliation')) return 'reconciliation';
      return 'queue';
    },
    userInitials() {
      if (!this.user||!this.user.displayName) return '?';
      return this.user.displayName.trim().split(/\s+/).slice(0,2).map(n=>n[0].toUpperCase()).join('');
    }
  },
  methods: { async signOut() { await signOutUser(); } },
  mounted() {
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        const allowed = await checkWhitelist(user.email);
        if (!allowed) {
          await signOutUser();
          this.whitelistError = true;
          this.user = null;
        } else {
          this.user = user;
          this.whitelistError = false;
        }
      } else {
        this.user = null;
      }
      this.authChecked = true;
    });
  },
  template: `
    <div>
      <div class="auth-loading" v-if="!authChecked"><i class="ti ti-loader spin" style="font-size:28px;color:var(--teal-mid)"></i></div>
      <Login v-else-if="!user" :whitelist-error="whitelistError" />
      <div class="layout" v-else>
        <aside class="sidebar">
          <div class="sidebar-logo"><span class="sidebar-name">Aangan Clinic</span><span class="sidebar-sub">Women\u2019s health centre</span></div>
          <nav class="sidebar-nav">
            <button class="nav-btn" :class="{on:section==='queue'}"          @click="$router.push('/queue')"><i class="ti ti-layout-list"></i> Work queue</button>
            <button class="nav-btn" :class="{on:section==='patients'}"       @click="$router.push('/patients')"><i class="ti ti-users"></i> Patients</button>
            <button class="nav-btn" :class="{on:section==='followups'}"      @click="$router.push('/followups')"><i class="ti ti-calendar-check"></i> Follow-ups</button>
            <button class="nav-btn" :class="{on:section==='billing'}"        @click="$router.push('/billing')"><i class="ti ti-receipt"></i> Billing</button>
            <button class="nav-btn" :class="{on:section==='reconciliation'}" @click="$router.push('/reconciliation')"><i class="ti ti-chart-bar"></i> Reconciliation</button>
          </nav>
          <div class="sidebar-footer">
            <div class="sidebar-user">
              <img v-if="user.photoURL" :src="user.photoURL" class="sidebar-user-avatar" referrerpolicy="no-referrer" />
              <div class="sidebar-user-avatar-placeholder" v-else>{{ userInitials }}</div>
              <div style="min-width:0"><div class="sidebar-user-name">{{ user.displayName||'Staff' }}</div><div class="sidebar-user-email">{{ user.email }}</div></div>
            </div>
            <button class="sign-out-btn" @click="signOut"><i class="ti ti-logout"></i> Sign out</button>
          </div>
        </aside>
        <main class="main-area"><router-view></router-view></main>
      </div>
    </div>
  `
};

// ================================================================
//  MOUNT
// ================================================================

const app = createApp(App);
app.use(router);
app.mount('#app');
