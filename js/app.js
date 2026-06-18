const { createApp } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// ================================================================
//  LOGIN SCREEN
// ================================================================

const Login = {
  name: 'Login',
  data() { return { signing: false, error: null }; },
  methods: {
    async signIn() {
      this.signing = true;
      this.error   = null;
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
        <p class="login-error" v-if="error">{{ error }}</p>
      </div>
    </div>
  `
};

// ================================================================
//  STEP 3: PATIENT SCREENS
// ================================================================

const PatientSearch = {
  name: 'PatientSearch',
  data() {
    return { query: '', allPatients: [], loading: true, loadError: null, filter: 'all' };
  },
  computed: {
    filteredPatients() {
      let pts = this.allPatients;
      if (this.filter === 'adults')   pts = pts.filter(p => p.type !== 'child');
      if (this.filter === 'children') pts = pts.filter(p => p.type === 'child');
      if (!this.query.trim()) return pts;
      const q = this.query.toLowerCase();
      return pts.filter(p =>
        (p.name      || '').toLowerCase().includes(q) ||
        (p.mobile    || '').includes(q) ||
        (p.patientId || '').toLowerCase().includes(q)
      );
    }
  },
  methods: {
    async loadPatients() {
      this.loading = true; this.loadError = null;
      try { this.allPatients = await getAllPatients(); }
      catch (e) { this.loadError = 'Could not load patients. Check your Firebase connection.'; }
      finally { this.loading = false; }
    },
    initials(name)    { return patientInitials(name); },
    avatarClass(name) { return patientAvatarClass(name); },
    age(dob)          { const a = calcAge(dob); return a !== null ? a + ' yrs' : null; },
    clearSearch()     { this.query = ''; }
  },
  mounted() { this.loadPatients(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left"><h1>Patients</h1></div>
        <div class="topbar-right">
          <button class="btn btn-primary" @click="$router.push('/patients/new')"><i class="ti ti-user-plus"></i> New patient</button>
        </div>
      </div>
      <div class="content">
        <div class="search-wrap">
          <i class="ti ti-search"></i>
          <input type="text" v-model="query" class="search-input" placeholder="Search by name, mobile, or patient ID\u2026" />
          <button class="search-clear" v-if="query" @click="clearSearch"><i class="ti ti-x"></i></button>
        </div>
        <div class="filter-bar">
          <button class="filter-btn" :class="{ on: filter === 'all' }"      @click="filter = 'all'">All</button>
          <button class="filter-btn" :class="{ on: filter === 'adults' }"   @click="filter = 'adults'">Adults</button>
          <button class="filter-btn" :class="{ on: filter === 'children' }" @click="filter = 'children'">Children</button>
        </div>
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading patients\u2026</div>
        <div class="empty-section" v-else-if="loadError"><i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p></div>
        <div class="empty-section" v-else-if="allPatients.length === 0">
          <i class="ti ti-users"></i><p>No patients registered yet</p>
          <button class="btn btn-primary" style="margin-top:14px" @click="$router.push('/patients/new')"><i class="ti ti-user-plus"></i> Register first patient</button>
        </div>
        <template v-else>
          <p class="results-meta" v-if="query">{{ filteredPatients.length }} result{{ filteredPatients.length === 1 ? '' : 's' }} for &ldquo;{{ query }}&rdquo;</p>
          <p class="results-meta" v-else>{{ filteredPatients.length }} patient{{ filteredPatients.length === 1 ? '' : 's' }}</p>
          <div class="empty-section" v-if="filteredPatients.length === 0"><i class="ti ti-zoom-cancel"></i><p>No patients match &ldquo;{{ query }}&rdquo;</p></div>
          <div class="pt-card" v-for="p in filteredPatients" :key="p.id" @click="$router.push('/patients/' + p.id)">
            <div class="avatar avatar-md" :class="p.type === 'child' ? 'avatar-blue' : avatarClass(p.name)">{{ initials(p.name) }}</div>
            <div class="pt-info">
              <div class="pt-name">{{ p.name }}</div>
              <div class="pt-meta">{{ p.patientId }}<template v-if="age(p.dob)"> &middot; {{ age(p.dob) }}</template> &middot; {{ p.mobile || p.motherName }}</div>
            </div>
            <div class="pt-right">
              <span class="pill pill-blue"  v-if="p.type === 'child'">Child</span>
              <span class="pill pill-teal"  v-else>Adult</span>
            </div>
            <i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:15px;flex-shrink:0"></i>
          </div>
        </template>
      </div>
    </div>
  `
};

// ----------------------------------------------------------------

const NewPatient = {
  name: 'NewPatient',
  data() {
    return {
      form: { name: '', mobile: '', dob: '', bloodGroup: '', address: '', husbandName: '', waConsent: true },
      saving: false, errors: {}
    };
  },
  methods: {
    validate() {
      this.errors = {};
      if (!this.form.name.trim())   this.errors.name   = 'Patient name is required';
      if (!this.form.mobile.trim()) this.errors.mobile = 'Mobile number is required';
      else if (!/^\d{10}$/.test(this.form.mobile.trim())) this.errors.mobile = 'Enter a valid 10-digit mobile number';
      return Object.keys(this.errors).length === 0;
    },
    async save() {
      if (!this.validate()) return;
      this.saving = true;
      try {
        const patient = await createPatient(this.form);
        this.$router.push('/patients/' + patient.id);
      } catch (e) {
        alert('Error saving patient. Please try again.');
      } finally { this.saving = false; }
    }
  },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/patients')"><i class="ti ti-arrow-left"></i> Patients</button>
            <span class="sep">/</span><span class="current">New patient</span>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="form-card">
          <div class="form-card-title">Register new patient</div>
          <p class="form-section-title">Patient information</p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Name <span class="form-required">*</span></label>
              <input type="text" v-model="form.name" class="form-input" :class="{ 'input-error': errors.name }" placeholder="Full name" />
              <p class="form-error" v-if="errors.name">{{ errors.name }}</p>
            </div>
            <div class="form-group">
              <label class="form-label">Mobile <span class="form-required">*</span></label>
              <input type="tel" v-model="form.mobile" class="form-input" :class="{ 'input-error': errors.mobile }" placeholder="10-digit mobile" maxlength="10" />
              <p class="form-error" v-if="errors.mobile">{{ errors.mobile }}</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date of birth</label>
              <input type="date" v-model="form.dob" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Blood group</label>
              <select v-model="form.bloodGroup" class="form-select">
                <option value="">Select</option>
                <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
              </select>
            </div>
          </div>
          <p class="form-section-title">Additional information</p>
          <div class="form-group">
            <label class="form-label">Husband&rsquo;s name</label>
            <input type="text" v-model="form.husbandName" class="form-input" placeholder="Optional" />
          </div>
          <div class="form-group">
            <label class="form-label">Address</label>
            <textarea v-model="form.address" class="form-input" rows="2" placeholder="Optional" style="resize:vertical"></textarea>
          </div>
          <p class="form-section-title">WhatsApp</p>
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.waConsent" />
            Patient has consented to receive WhatsApp messages from the clinic
          </label>
          <div class="form-actions">
            <button class="btn btn-primary" @click="save" :disabled="saving">
              <i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-check" v-else></i>
              {{ saving ? 'Saving\u2026' : 'Save patient' }}
            </button>
            <button class="btn btn-secondary" @click="$router.push('/patients')" :disabled="saving">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};

// ----------------------------------------------------------------

const PatientEdit = {
  name: 'PatientEdit',
  data() {
    return {
      form: { name: '', mobile: '', dob: '', bloodGroup: '', address: '', husbandName: '', waConsent: false },
      saving: false, loading: true, errors: {}
    };
  },
  methods: {
    async loadPatient() {
      this.loading = true;
      try {
        const p = await getPatient(this.$route.params.id);
        if (p) this.form = { name: p.name||'', mobile: p.mobile||'', dob: p.dob||'', bloodGroup: p.bloodGroup||'', address: p.address||'', husbandName: p.husbandName||'', waConsent: !!p.waConsent };
      } finally { this.loading = false; }
    },
    validate() {
      this.errors = {};
      if (!this.form.name.trim())   this.errors.name   = 'Patient name is required';
      if (!this.form.mobile.trim()) this.errors.mobile = 'Mobile number is required';
      else if (!/^\d{10}$/.test(this.form.mobile.trim())) this.errors.mobile = 'Enter a valid 10-digit mobile number';
      return Object.keys(this.errors).length === 0;
    },
    async save() {
      if (!this.validate()) return;
      this.saving = true;
      try {
        await updatePatient(this.$route.params.id, this.form);
        this.$router.push('/patients/' + this.$route.params.id);
      } catch (e) { alert('Error saving. Please try again.'); }
      finally { this.saving = false; }
    }
  },
  mounted() { this.loadPatient(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/patients/' + $route.params.id)"><i class="ti ti-arrow-left"></i> Patient</button>
            <span class="sep">/</span><span class="current">Edit</span>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="form-card" v-else>
          <div class="form-card-title">Edit patient</div>
          <p class="form-section-title">Patient information</p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Name <span class="form-required">*</span></label>
              <input type="text" v-model="form.name" class="form-input" :class="{ 'input-error': errors.name }" />
              <p class="form-error" v-if="errors.name">{{ errors.name }}</p>
            </div>
            <div class="form-group">
              <label class="form-label">Mobile <span class="form-required">*</span></label>
              <input type="tel" v-model="form.mobile" class="form-input" :class="{ 'input-error': errors.mobile }" maxlength="10" />
              <p class="form-error" v-if="errors.mobile">{{ errors.mobile }}</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date of birth</label>
              <input type="date" v-model="form.dob" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Blood group</label>
              <select v-model="form.bloodGroup" class="form-select">
                <option value="">Select</option>
                <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
              </select>
            </div>
          </div>
          <p class="form-section-title">Additional information</p>
          <div class="form-group">
            <label class="form-label">Husband&rsquo;s name</label>
            <input type="text" v-model="form.husbandName" class="form-input" placeholder="Optional" />
          </div>
          <div class="form-group">
            <label class="form-label">Address</label>
            <textarea v-model="form.address" class="form-input" rows="2" style="resize:vertical"></textarea>
          </div>
          <p class="form-section-title">WhatsApp</p>
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.waConsent" />
            Patient has consented to receive WhatsApp messages from the clinic
          </label>
          <div class="form-actions">
            <button class="btn btn-primary" @click="save" :disabled="saving">
              <i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-check" v-else></i>
              {{ saving ? 'Saving\u2026' : 'Save changes' }}
            </button>
            <button class="btn btn-secondary" @click="$router.push('/patients/' + $route.params.id)" :disabled="saving">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};

// ================================================================
//  STEP 4: CHILD REGISTRATION
// ================================================================

const ChildRegistration = {
  name: 'ChildRegistration',
  data() {
    return {
      mother: null,
      loadingMother: true,
      form: { name: '', dob: '', gender: '', birthWeight: '' },
      saving: false,
      errors: {}
    };
  },
  methods: {
    async loadMother() {
      this.loadingMother = true;
      try {
        this.mother = await getPatient(this.$route.params.id);
        if (this.mother && !this.form.name) {
          this.form.name = 'Baby of ' + this.mother.name;
        }
      } finally { this.loadingMother = false; }
    },
    validate() {
      this.errors = {};
      if (!this.form.name.trim()) this.errors.name = 'Child name is required';
      if (!this.form.dob) this.errors.dob = 'Date of birth is required to generate vaccination schedule';
      return Object.keys(this.errors).length === 0;
    },
    async save() {
      if (!this.validate()) return;
      this.saving = true;
      try {
        await createChild(this.$route.params.id, this.form, this.mother);
        this.$router.push('/patients/' + this.$route.params.id);
      } catch (e) {
        alert('Error saving. Please try again.');
      } finally { this.saving = false; }
    }
  },
  mounted() { this.loadMother(); },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left">
          <div class="topbar-breadcrumb">
            <button class="btn btn-secondary btn-sm" @click="$router.push('/patients/' + $route.params.id)">
              <i class="ti ti-arrow-left"></i> {{ mother ? mother.name : 'Patient' }}
            </button>
            <span class="sep">/</span>
            <span class="current">Register child</span>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="loading-wrap" v-if="loadingMother"><i class="ti ti-loader spin"></i> Loading\u2026</div>
        <div class="form-card" v-else>
          <div class="form-card-title">Register child</div>

          <div class="mother-context" v-if="mother">
            <i class="ti ti-user"></i>
            Mother: <strong>{{ mother.name }}</strong> &middot; {{ mother.patientId }}
          </div>

          <p class="form-section-title">Child information</p>
          <div class="form-group">
            <label class="form-label">Child\u2019s name <span class="form-required">*</span></label>
            <input type="text" v-model="form.name" class="form-input" :class="{ 'input-error': errors.name }" placeholder="Full name or Baby of [Mother]" />
            <p class="form-error" v-if="errors.name">{{ errors.name }}</p>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date of birth <span class="form-required">*</span></label>
              <input type="date" v-model="form.dob" class="form-input" :class="{ 'input-error': errors.dob }" />
              <p class="form-error" v-if="errors.dob">{{ errors.dob }}</p>
              <p style="font-size:11px;color:var(--text-muted);margin-top:4px">Needed to auto-generate vaccination schedule in Step 5</p>
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
              <select v-model="form.gender" class="form-select">
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Birth weight (kg)</label>
            <input type="number" v-model="form.birthWeight" class="form-input" placeholder="e.g. 3.2" step="0.01" min="0.5" max="6" />
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" @click="save" :disabled="saving">
              <i class="ti ti-loader spin" v-if="saving"></i><i class="ti ti-check" v-else></i>
              {{ saving ? 'Saving\u2026' : 'Register child' }}
            </button>
            <button class="btn btn-secondary" @click="$router.push('/patients/' + $route.params.id)" :disabled="saving">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};

// ================================================================
//  PATIENT PROFILE  (updated for Step 4: children + child view)
// ================================================================

const PatientProfile = {
  name: 'PatientProfile',
  data() {
    return { patient: null, loading: true, loadError: null, children: [], mother: null };
  },
  computed: {
    isChild()     { return this.patient && this.patient.type === 'child'; },
    initials()    { return this.patient ? patientInitials(this.patient.name) : '?'; },
    avatarClass() {
      if (!this.patient) return 'avatar-teal';
      return this.isChild ? 'avatar-blue' : patientAvatarClass(this.patient.name);
    },
    ageLabel() {
      if (!this.patient || !this.patient.dob) return '\u2014';
      const today = new Date();
      const birth = new Date(this.patient.dob);
      let yrs = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) yrs--;
      if (yrs < 2) {
        let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
        if (today.getDate() < birth.getDate()) months--;
        if (months < 1) return 'Newborn';
        return months + (months === 1 ? ' month' : ' months');
      }
      return yrs + ' yrs';
    },
    dobLabel()   { return this.patient ? formatDateIn(this.patient.dob) : '\u2014'; },
    waHref() {
      if (!this.patient || !this.patient.waConsent || !this.patient.mobile) return null;
      const contactName = this.isChild ? (this.patient.motherName || this.patient.name) : this.patient.name;
      const childPart   = this.isChild ? ' regarding ' + this.patient.name + '\u2019s vaccination' : '';
      const msg = 'Dear ' + contactName + ',\n\nThis is a reminder from Aangan Clinic' + childPart + '.\n\nPlease contact us if you have any questions.\n\nAangan Clinic';
      return waLink(this.patient.mobile, contactName, msg);
    }
  },
  methods: {
    async loadPatient() {
      this.loading = true; this.loadError = null; this.patient = null; this.children = []; this.mother = null;
      try {
        this.patient = await getPatient(this.$route.params.id);
        if (!this.patient) {
          this.loadError = 'Patient record not found.';
        } else if (!this.isChild) {
          this.children = await getChildrenByMother(this.patient.id);
        } else if (this.patient.motherId) {
          this.mother = await getPatient(this.patient.motherId);
        }
      } catch (e) {
        this.loadError = 'Could not load patient. Check your Firebase connection.';
      } finally { this.loading = false; }
    },
    childAge(dob) {
      if (!dob) return null;
      const today = new Date(); const birth = new Date(dob);
      let yrs = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) yrs--;
      if (yrs < 2) {
        let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
        if (today.getDate() < birth.getDate()) months--;
        return months < 1 ? 'Newborn' : months + (months === 1 ? ' mo' : ' mo');
      }
      return yrs + ' yrs';
    },
    fmtDate(d)        { return formatDateIn(d); },
    cInitials(name)   { return patientInitials(name); },
    cAvatarClass(name){ return patientAvatarClass(name); }
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
            <span class="current">{{ loading ? 'Loading\u2026' : (patient ? patient.name : 'Not found') }}</span>
          </div>
        </div>
        <div class="topbar-right" v-if="patient">
          <button class="btn btn-secondary btn-sm" @click="$router.push('/encounters/new')"><i class="ti ti-notes"></i> New encounter</button>
          <button class="btn btn-primary btn-sm" @click="$router.push('/followups/new')"><i class="ti ti-calendar-plus"></i> New follow-up</button>
        </div>
      </div>

      <div class="content">
        <div class="loading-wrap" v-if="loading"><i class="ti ti-loader spin"></i> Loading patient\u2026</div>

        <div class="empty-section" v-else-if="loadError">
          <i class="ti ti-alert-triangle"></i><p>{{ loadError }}</p>
          <button class="btn btn-secondary" style="margin-top:14px" @click="$router.push('/patients')">Back to patients</button>
        </div>

        <template v-else-if="patient">

          <!-- Profile header (shared: adults + children) -->
          <div class="profile-header">
            <div class="avatar avatar-lg" :class="avatarClass">{{ initials }}</div>
            <div style="flex:1;min-width:0">
              <div class="profile-name">{{ patient.name }}</div>
              <div class="profile-sub">
                {{ patient.patientId }} &middot; {{ ageLabel }}
                <template v-if="patient.mobile"> &middot; {{ patient.mobile }}</template>
              </div>
              <div class="profile-sub" v-if="!isChild && patient.husbandName">Husband: {{ patient.husbandName }}</div>
              <div class="profile-tags">
                <span class="pill pill-blue" v-if="isChild">Child</span>
                <span class="pill pill-gray" v-else>Adult</span>
                <span class="pill pill-pink" v-if="patient.gender === 'female'">Female</span>
                <span class="pill pill-sky"  v-if="patient.gender === 'male'">Male</span>
                <span class="pill pill-teal" v-if="patient.waConsent"><i class="ti ti-brand-whatsapp" style="font-size:10px"></i> WA consent</span>
                <span class="pill pill-gray" v-else style="opacity:0.6">No WA consent</span>
              </div>
            </div>
            <div class="profile-actions">
              <a v-if="waHref" :href="waHref" target="_blank" class="btn btn-secondary btn-sm">
                <i class="ti ti-brand-whatsapp" style="color:var(--teal-mid)"></i> WhatsApp
              </a>
              <button v-else class="btn btn-secondary btn-sm" style="opacity:0.45" disabled><i class="ti ti-brand-whatsapp"></i> WhatsApp</button>
              <button class="btn btn-secondary btn-sm" @click="$router.push('/patients/' + patient.id + '/edit')"><i class="ti ti-edit"></i> Edit</button>
            </div>
          </div>

          <!-- ADULT: Info card -->
          <div class="info-card" v-if="!isChild && (patient.dob || patient.bloodGroup || patient.address)">
            <div class="info-grid">
              <div class="info-item" v-if="patient.dob"><div class="info-label">Date of birth</div><div class="info-value">{{ dobLabel }}</div></div>
              <div class="info-item" v-if="patient.bloodGroup"><div class="info-label">Blood group</div><div class="info-value">{{ patient.bloodGroup }}</div></div>
              <div class="info-item info-full" v-if="patient.address"><div class="info-label">Address</div><div class="info-value">{{ patient.address }}</div></div>
            </div>
          </div>

          <!-- CHILD: Info card -->
          <div class="info-card" v-if="isChild && (patient.dob || patient.gender || patient.birthWeight)">
            <div class="info-grid">
              <div class="info-item" v-if="patient.dob"><div class="info-label">Date of birth</div><div class="info-value">{{ dobLabel }}</div></div>
              <div class="info-item" v-if="patient.gender"><div class="info-label">Gender</div><div class="info-value" style="text-transform:capitalize">{{ patient.gender }}</div></div>
              <div class="info-item" v-if="patient.birthWeight"><div class="info-label">Birth weight</div><div class="info-value">{{ patient.birthWeight }} kg</div></div>
            </div>
          </div>

          <!-- CHILD: Mother link -->
          <template v-if="isChild">
            <div class="section-header"><div class="section-title"><i class="ti ti-user" style="color:var(--teal-mid)"></i> Mother</div></div>
            <div class="mother-link-card" v-if="mother" @click="$router.push('/patients/' + mother.id)">
              <div class="avatar avatar-md" :class="cAvatarClass(mother.name)">{{ cInitials(mother.name) }}</div>
              <div style="flex:1">
                <div class="mother-link-label">Mother&rsquo;s record</div>
                <div class="mother-link-name">{{ mother.name }} &middot; {{ mother.patientId }}</div>
              </div>
              <i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:15px"></i>
            </div>
            <div class="section-card" style="margin-bottom:16px" v-else>
              <div class="empty-section" style="padding:16px"><p>Mother record not linked</p></div>
            </div>
          </template>

          <!-- ADULT: Children section (Step 4) -->
          <template v-if="!isChild">
            <div class="section-header">
              <div class="section-title"><i class="ti ti-heart" style="color:var(--teal-mid)"></i> Children</div>
              <button class="btn btn-primary btn-sm" @click="$router.push('/patients/' + patient.id + '/child')"><i class="ti ti-plus"></i> Register child</button>
            </div>
            <div class="section-card" style="margin-bottom:16px">
              <template v-if="children.length > 0">
                <div class="child-card" v-for="c in children" :key="c.id" @click="$router.push('/patients/' + c.id)">
                  <div class="avatar avatar-sm avatar-blue">{{ cInitials(c.name) }}</div>
                  <div style="flex:1">
                    <div class="child-name">{{ c.name }}</div>
                    <div class="child-meta">
                      {{ c.patientId }}
                      <template v-if="childAge(c.dob)"> &middot; {{ childAge(c.dob) }}</template>
                      <template v-if="c.gender"> &middot; <span style="text-transform:capitalize">{{ c.gender }}</span></template>
                      <template v-if="c.dob"> &middot; {{ fmtDate(c.dob) }}</template>
                    </div>
                  </div>
                  <i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:14px"></i>
                </div>
              </template>
              <div class="empty-section" style="padding:20px" v-else>
                <i class="ti ti-heart"></i>
                <p>No children registered</p>
              </div>
            </div>
          </template>

          <!-- CHILD: Vaccination schedule -->
          <template v-if="isChild">
            <div class="section-header">
              <div class="section-title"><i class="ti ti-vaccine" style="color:var(--teal-mid)"></i> Vaccination schedule</div>
              <button class="btn btn-primary btn-sm" @click="$router.push('/followups/new')"><i class="ti ti-plus"></i> New</button>
            </div>
            <div class="section-card" style="margin-bottom:16px">
              <div class="empty-section" style="padding:22px">
                <i class="ti ti-calendar"></i>
                <p>Vaccination schedule not yet generated</p>
                <p style="font-size:11px;color:#ccc;margin-top:2px">Auto-generated from DOB in Step 5</p>
              </div>
            </div>
          </template>

          <!-- ADULT: Active follow-up cases -->
          <template v-if="!isChild">
            <div class="section-header">
              <div class="section-title"><i class="ti ti-calendar-check" style="color:var(--teal-mid)"></i> Active follow-up cases</div>
              <button class="btn btn-primary btn-sm" @click="$router.push('/followups/new')"><i class="ti ti-plus"></i> New</button>
            </div>
            <div class="section-card" style="margin-bottom:16px">
              <div class="empty-section" style="padding:22px">
                <i class="ti ti-calendar"></i><p>No active follow-up cases</p>
                <p style="font-size:11px;color:#ccc;margin-top:2px">Coming in Step 5</p>
              </div>
            </div>
          </template>

          <!-- Recent encounters (both adults and children) -->
          <div class="section-header">
            <div class="section-title"><i class="ti ti-stethoscope" style="color:var(--teal-mid)"></i> Recent encounters</div>
            <button class="btn btn-secondary btn-sm" @click="$router.push('/encounters/new')"><i class="ti ti-plus"></i> New</button>
          </div>
          <div class="section-card">
            <div class="empty-section" style="padding:22px">
              <i class="ti ti-notes"></i><p>No encounters recorded yet</p>
              <p style="font-size:11px;color:#ccc;margin-top:2px">Coming in Step 9</p>
            </div>
          </div>

        </template>
      </div>
    </div>
  `
};

// ================================================================
//  REMAINING SCREENS  (Steps 5–14: placeholders)
// ================================================================

const WorkQueue = {
  name: 'WorkQueue',
  computed: { todayLabel() { return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } },
  template: `
    <div class="screen">
      <div class="topbar">
        <div class="topbar-left"><h1>Today\u2019s work queue</h1><p>{{ todayLabel }}</p></div>
        <div class="topbar-right"><button class="btn btn-primary" @click="$router.push('/patients/new')"><i class="ti ti-user-plus"></i> New patient</button></div>
      </div>
      <div class="content"><div class="placeholder-screen"><i class="ti ti-layout-list"></i><h2>Work queue</h2><p class="sub">Reminders, missed follow-ups, overdue patients</p><p class="step">Step 7 of the build plan</p></div></div>
    </div>`
};

const FollowupList = {
  name: 'FollowupList',
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><h1>Follow-ups</h1></div><div class="topbar-right"><button class="btn btn-primary" @click="$router.push('/followups/new')"><i class="ti ti-plus"></i> New follow-up</button></div></div>
      <div class="content"><div class="placeholder-screen"><i class="ti ti-calendar-check"></i><h2>All follow-up cases</h2><p class="sub">ANC, vaccination, post-procedure, annual recall</p><p class="step">Steps 5&ndash;8 of the build plan</p></div></div>
    </div>`
};

const FollowupCreation = {
  name: 'FollowupCreation',
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.go(-1)"><i class="ti ti-arrow-left"></i> Back</button><span class="sep">/</span><span class="current">New follow-up</span></div></div></div>
      <div class="content"><div class="placeholder-screen"><i class="ti ti-calendar-plus"></i><h2>Create follow-up</h2><p class="sub">ANC &middot; Vaccination &middot; Post-procedure &middot; Annual recall</p><p class="step">Step 5 of the build plan</p></div></div>
    </div>`
};

const FollowupDetail = {
  name: 'FollowupDetail',
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.push('/followups')"><i class="ti ti-arrow-left"></i> Follow-ups</button><span class="sep">/</span><span class="current">Case detail</span></div></div></div>
      <div class="content"><div class="placeholder-screen"><i class="ti ti-clipboard-list"></i><h2>Follow-up case detail</h2><p class="sub">Status, reminders, contact outcomes, escalation</p><p class="step">Steps 6&ndash;8 of the build plan</p></div></div>
    </div>`
};

const Encounter = {
  name: 'Encounter',
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><div class="topbar-breadcrumb"><button class="btn btn-secondary btn-sm" @click="$router.go(-1)"><i class="ti ti-arrow-left"></i> Back</button><span class="sep">/</span><span class="current">New encounter</span></div></div></div>
      <div class="content"><div class="placeholder-screen"><i class="ti ti-stethoscope"></i><h2>Encounter / visit</h2><p class="sub">Date, doctor, notes, diagnosis &mdash; closes follow-up and creates the next</p><p class="step">Step 9 of the build plan</p></div></div>
    </div>`
};

const Billing = {
  name: 'Billing',
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><h1>Billing</h1></div><div class="topbar-right"><button class="btn btn-primary"><i class="ti ti-plus"></i> New invoice</button></div></div>
      <div class="content"><div class="placeholder-screen"><i class="ti ti-receipt"></i><h2>Billing &amp; invoices</h2><p class="sub">Invoices, payments, print and PDF export</p><p class="step">Step 10 of the build plan</p></div></div>
    </div>`
};

const Reconciliation = {
  name: 'Reconciliation',
  template: `
    <div class="screen">
      <div class="topbar"><div class="topbar-left"><h1>Daily reconciliation</h1></div></div>
      <div class="content"><div class="placeholder-screen"><i class="ti ti-chart-bar"></i><h2>Daily reconciliation</h2><p class="sub">Cash, UPI, card, bank &mdash; verify and close the day</p><p class="step">Step 11 of the build plan</p></div></div>
    </div>`
};

// ================================================================
//  ROUTER
// ================================================================

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path: '/',                   redirect: '/queue' },
    { path: '/queue',              component: WorkQueue },
    { path: '/patients',           component: PatientSearch },
    { path: '/patients/new',       component: NewPatient },
    { path: '/patients/:id',       component: PatientProfile },
    { path: '/patients/:id/edit',  component: PatientEdit },
    { path: '/patients/:id/child', component: ChildRegistration },
    { path: '/followups',          component: FollowupList },
    { path: '/followups/new',      component: FollowupCreation },
    { path: '/followups/:id',      component: FollowupDetail },
    { path: '/encounters/new',     component: Encounter },
    { path: '/billing',            component: Billing },
    { path: '/reconciliation',     component: Reconciliation },
  ]
});

// ================================================================
//  ROOT APP
// ================================================================

const App = {
  name: 'App',
  components: { Login },
  data() { return { user: null, authChecked: false }; },
  computed: {
    section() {
      const p = this.$route.path;
      if (p.startsWith('/patients'))       return 'patients';
      if (p.startsWith('/followups'))      return 'followups';
      if (p.startsWith('/billing'))        return 'billing';
      if (p.startsWith('/reconciliation')) return 'reconciliation';
      return 'queue';
    },
    userInitials() {
      if (!this.user || !this.user.displayName) return '?';
      return this.user.displayName.trim().split(/\s+/).slice(0,2).map(n => n[0].toUpperCase()).join('');
    }
  },
  methods: { async signOut() { await signOutUser(); } },
  mounted() { firebase.auth().onAuthStateChanged(user => { this.user = user; this.authChecked = true; }); },
  template: `
    <div>
      <div class="auth-loading" v-if="!authChecked">
        <i class="ti ti-loader spin" style="font-size:28px;color:var(--teal-mid)"></i>
      </div>
      <Login v-else-if="!user" />
      <div class="layout" v-else>
        <aside class="sidebar">
          <div class="sidebar-logo">
            <span class="sidebar-name">Aangan Clinic</span>
            <span class="sidebar-sub">Women\u2019s health centre</span>
          </div>
          <nav class="sidebar-nav">
            <button class="nav-btn" :class="{ on: section === 'queue' }"          @click="$router.push('/queue')"><i class="ti ti-layout-list"></i> Work queue</button>
            <button class="nav-btn" :class="{ on: section === 'patients' }"       @click="$router.push('/patients')"><i class="ti ti-users"></i> Patients</button>
            <button class="nav-btn" :class="{ on: section === 'followups' }"      @click="$router.push('/followups')"><i class="ti ti-calendar-check"></i> Follow-ups</button>
            <button class="nav-btn" :class="{ on: section === 'billing' }"        @click="$router.push('/billing')"><i class="ti ti-receipt"></i> Billing</button>
            <button class="nav-btn" :class="{ on: section === 'reconciliation' }" @click="$router.push('/reconciliation')"><i class="ti ti-chart-bar"></i> Reconciliation</button>
          </nav>
          <div class="sidebar-footer">
            <div class="sidebar-user">
              <img v-if="user.photoURL" :src="user.photoURL" class="sidebar-user-avatar" referrerpolicy="no-referrer" />
              <div class="sidebar-user-avatar-placeholder" v-else>{{ userInitials }}</div>
              <div style="min-width:0">
                <div class="sidebar-user-name">{{ user.displayName || 'Staff' }}</div>
                <div class="sidebar-user-email">{{ user.email }}</div>
              </div>
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
