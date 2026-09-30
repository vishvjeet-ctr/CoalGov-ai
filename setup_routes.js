const fs = require('fs');
const path = require('path');

const root = path.join(__dirname);

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function write(file, content) {
    const fullPath = path.join(root, file);
    ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
}

// 1. Admin
write('routes/admin.routes.js', `
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { isAuthenticated, authorize } = require('../middleware/auth');

router.use(isAuthenticated, authorize('admin'));

router.get('/users', adminController.getUsers);
router.get('/users/create', adminController.getCreateUser);
router.post('/users/create', adminController.createUser);
router.get('/users/:id', adminController.getUserDetail);
router.post('/users/:id/approve', adminController.approveUser);
router.post('/users/:id/reject', adminController.rejectUser);
router.post('/users/:id/suspend', adminController.suspendUser);

router.get('/mines', adminController.getMines);
router.get('/mines/create', adminController.getCreateMine);
router.post('/mines/create', adminController.createMine);
router.get('/mines/:id', adminController.getMineDetail);
router.post('/mines/:id', adminController.updateMine);

router.get('/sla-config', adminController.getSlaConfig);
router.post('/sla-config', adminController.updateSlaConfig);

router.get('/registration-requests', adminController.getRegistrationRequests);
router.post('/demo/reset', adminController.resetDemo);
router.post('/demo/seed', adminController.seedDemo);

module.exports = router;
`);

write('controllers/admin.controller.js', `
const User = require('../models/user.model');
const Mine = require('../models/mine.model');

exports.getUsers = async (req, res, next) => {
    try {
        const users = await User.find().populate('assignedMine');
        res.render('admin/users', { title: 'Manage Users', breadcrumb: 'Admin / Users', users });
    } catch (error) { next(error); }
};

exports.getCreateUser = async (req, res, next) => {
    try {
        const mines = await Mine.find();
        res.render('admin/create-user', { title: 'Create User', breadcrumb: 'Admin / Users / Create', mines });
    } catch (error) { next(error); }
};

exports.createUser = async (req, res, next) => {
    try {
        const user = new User(req.body);
        await user.save();
        req.flash('success', 'User created successfully');
        res.redirect('/admin/users');
    } catch (error) { next(error); }
};

exports.getUserDetail = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).populate('assignedMine');
        res.render('admin/user-detail', { title: 'User Detail', breadcrumb: 'Admin / Users / Detail', userDetail: user });
    } catch (error) { next(error); }
};

exports.approveUser = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { status: 'active' });
        res.redirect('/admin/users/' + req.params.id);
    } catch (error) { next(error); }
};

exports.rejectUser = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { status: 'rejected' });
        res.redirect('/admin/users/' + req.params.id);
    } catch (error) { next(error); }
};

exports.suspendUser = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { status: 'suspended' });
        res.redirect('/admin/users/' + req.params.id);
    } catch (error) { next(error); }
};

exports.getMines = async (req, res, next) => {
    try {
        const mines = await Mine.find();
        res.render('admin/mines', { title: 'Manage Mines', breadcrumb: 'Admin / Mines', mines });
    } catch (error) { next(error); }
};

exports.getCreateMine = async (req, res, next) => {
    res.render('admin/create-mine', { title: 'Create Mine', breadcrumb: 'Admin / Mines / Create' });
};

exports.createMine = async (req, res, next) => {
    try {
        await Mine.create(req.body);
        res.redirect('/admin/mines');
    } catch (error) { next(error); }
};

exports.getMineDetail = async (req, res, next) => {
    try {
        const mine = await Mine.findById(req.params.id);
        res.render('admin/mine-detail', { title: 'Mine Detail', breadcrumb: 'Admin / Mines / Detail', mine });
    } catch (error) { next(error); }
};

exports.updateMine = async (req, res, next) => {
    try {
        await Mine.findByIdAndUpdate(req.params.id, req.body);
        res.redirect('/admin/mines/' + req.params.id);
    } catch (error) { next(error); }
};

exports.getSlaConfig = async (req, res, next) => {
    res.render('admin/sla-config', { title: 'SLA Configuration', breadcrumb: 'Admin / SLA Config' });
};

exports.updateSlaConfig = async (req, res, next) => {
    res.redirect('/admin/sla-config');
};

exports.getRegistrationRequests = async (req, res, next) => {
    try {
        const users = await User.find({ status: 'pending' });
        res.render('admin/registration-requests', { title: 'Registration Requests', breadcrumb: 'Admin / Registration Requests', users });
    } catch (error) { next(error); }
};

exports.resetDemo = async (req, res, next) => res.redirect('/admin');
exports.seedDemo = async (req, res, next) => res.redirect('/admin');
`);

['users', 'user-detail', 'create-user', 'mines', 'create-mine', 'mine-detail', 'sla-config', 'registration-requests'].forEach(view => {
    let content = "<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>\n" +
                  "<div class='container mx-auto p-4'>\n" +
                  "    <h1 class='text-2xl font-bold mb-4'><%= title %></h1>\n" +
                  "    <p>View content for <%= title %></p>\n" +
                  "</div>\n" +
                  "<%- include('../partials/foot') %>";
    write("views/admin/" + view + ".ejs", content);
});

// 2. Inspections
write('routes/inspections.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/inspections.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', controller.getList);
router.get('/create', controller.getCreate);
router.post('/create', controller.create);
router.get('/:id', controller.getDetail);

module.exports = router;
`);

write('controllers/inspections.controller.js', `
exports.getList = async (req, res, next) => res.render('inspections/list', { title: 'Inspections', breadcrumb: 'Inspections' });
exports.getCreate = async (req, res, next) => res.render('inspections/create', { title: 'Create Inspection', breadcrumb: 'Inspections / Create' });
exports.create = async (req, res, next) => res.redirect('/inspections');
exports.getDetail = async (req, res, next) => res.render('inspections/detail', { title: 'Inspection Detail', breadcrumb: 'Inspections / Detail' });
`);

['list', 'create', 'detail'].forEach(view => {
    let content = "<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>\n" +
                  "<div class='container mx-auto p-4'><h1 class='text-2xl font-bold mb-4'><%= title %></h1></div>\n" +
                  "<%- include('../partials/foot') %>";
    write("views/inspections/" + view + ".ejs", content);
});

// 3. Corrective
write('routes/corrective.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/corrective.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', controller.getList);
router.get('/:id', controller.getDetail);

module.exports = router;
`);
write('controllers/corrective.controller.js', `
exports.getList = async (req, res, next) => res.render('corrective/list', { title: 'Corrective Actions', breadcrumb: 'Corrective Actions' });
exports.getDetail = async (req, res, next) => res.render('corrective/detail', { title: 'Action Detail', breadcrumb: 'Corrective Actions / Detail' });
`);
['list', 'detail'].forEach(view => {
    let content = "<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>\n" +
                  "<div class='container mx-auto p-4'><h1 class='text-2xl font-bold mb-4'><%= title %></h1></div>\n" +
                  "<%- include('../partials/foot') %>";
    write("views/corrective/" + view + ".ejs", content);
});

// 4. Compliance
write('routes/compliance.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/compliance.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', controller.getDashboard);
router.get('/create', controller.getCreate);
router.post('/create', controller.create);
router.get('/:id', controller.getDetail);
router.post('/:id/update', controller.updateStatus);

module.exports = router;
`);
write('controllers/compliance.controller.js', `
exports.getDashboard = async (req, res, next) => res.render('compliance/dashboard', { title: 'Compliance Dashboard', breadcrumb: 'Compliance' });
exports.getCreate = async (req, res, next) => res.render('compliance/dashboard', { title: 'Compliance Dashboard', breadcrumb: 'Compliance' }); // Using dashboard temp
exports.create = async (req, res, next) => res.redirect('/compliance');
exports.getDetail = async (req, res, next) => res.render('compliance/detail', { title: 'Requirement Detail', breadcrumb: 'Compliance / Detail' });
exports.updateStatus = async (req, res, next) => res.redirect('/compliance');
`);
['dashboard', 'detail'].forEach(view => {
    let content = "<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>\n" +
                  "<div class='container mx-auto p-4'><h1 class='text-2xl font-bold mb-4'><%= title %></h1></div>\n" +
                  "<%- include('../partials/foot') %>";
    write("views/compliance/" + view + ".ejs", content);
});

// 5. Contractors
write('routes/contractors.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/contractors.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', controller.getList);
router.get('/create', controller.getCreate);
router.post('/create', controller.create);
router.get('/:id', controller.getDetail);
module.exports = router;
`);
write('controllers/contractors.controller.js', `
exports.getList = async (req, res, next) => res.render('contractors/list', { title: 'Contractors', breadcrumb: 'Contractors' });
exports.getCreate = async (req, res, next) => res.render('contractors/list', { title: 'Create Contractor', breadcrumb: 'Contractors / Create' });
exports.create = async (req, res, next) => res.redirect('/contractors');
exports.getDetail = async (req, res, next) => res.render('contractors/detail', { title: 'Contractor Detail', breadcrumb: 'Contractors / Detail' });
`);
['list', 'detail'].forEach(view => {
    let content = "<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>\n" +
                  "<div class='container mx-auto p-4'><h1 class='text-2xl font-bold mb-4'><%= title %></h1></div>\n" +
                  "<%- include('../partials/foot') %>";
    write("views/contractors/" + view + ".ejs", content);
});

// 6. Reports
write('routes/reports.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/reports.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', controller.getIndex);
router.get('/violations', controller.getViolations);
router.get('/compliance', controller.getCompliance);
router.get('/inspections', controller.getInspections);
router.get('/sla', controller.getSLA);
router.get('/download/:type', controller.downloadCSV);
module.exports = router;
`);
write('controllers/reports.controller.js', `
exports.getIndex = async (req, res, next) => res.render('reports/index', { title: 'Reports', breadcrumb: 'Reports' });
exports.getViolations = async (req, res, next) => res.render('reports/view', { title: 'Violations Report', breadcrumb: 'Reports / Violations' });
exports.getCompliance = async (req, res, next) => res.render('reports/view', { title: 'Compliance Report', breadcrumb: 'Reports / Compliance' });
exports.getInspections = async (req, res, next) => res.render('reports/view', { title: 'Inspections Report', breadcrumb: 'Reports / Inspections' });
exports.getSLA = async (req, res, next) => res.render('reports/view', { title: 'SLA Report', breadcrumb: 'Reports / SLA' });
exports.downloadCSV = async (req, res, next) => res.send('CSV data');
`);
['index', 'view'].forEach(view => {
    let content = "<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>\n" +
                  "<div class='container mx-auto p-4'><h1 class='text-2xl font-bold mb-4'><%= title %></h1></div>\n" +
                  "<%- include('../partials/foot') %>";
    write("views/reports/" + view + ".ejs", content);
});

// 7. Notifications
write('routes/notifications.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/notifications.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', controller.getList);
router.post('/:id/read', controller.markRead);
router.post('/mark-all-read', controller.markAllRead);
module.exports = router;
`);
write('controllers/notifications.controller.js', `
exports.getList = async (req, res, next) => res.render('notifications/list', { title: 'Notifications', breadcrumb: 'Notifications' });
exports.markRead = async (req, res, next) => res.redirect('/notifications');
exports.markAllRead = async (req, res, next) => res.redirect('/notifications');
`);
write('views/notifications/list.ejs', `
<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>
<div class="container mx-auto p-4"><h1 class="text-2xl font-bold mb-4"><%= title %></h1></div>
<%- include('../partials/foot') %>
`);

// 8. Audit
write('routes/audit.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/audit.controller');
const { isAuthenticated, authorize } = require('../middleware/auth');

router.use(isAuthenticated, authorize('admin', 'regulator'));
router.get('/', controller.getLogs);
module.exports = router;
`);
write('controllers/audit.controller.js', `
exports.getLogs = async (req, res, next) => res.render('audit/logs', { title: 'Audit Logs', breadcrumb: 'Audit Logs' });
`);
write('views/audit/logs.ejs', `
<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>
<div class="container mx-auto p-4"><h1 class="text-2xl font-bold mb-4"><%= title %></h1></div>
<%- include('../partials/foot') %>
`);

// 9. Search
write('routes/search.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/search.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', controller.getSearch);
module.exports = router;
`);
write('controllers/search.controller.js', `
exports.getSearch = async (req, res, next) => res.render('search/results', { title: 'Search Results', breadcrumb: 'Search' });
`);
write('views/search/results.ejs', `
<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>
<div class="container mx-auto p-4"><h1 class="text-2xl font-bold mb-4"><%= title %></h1></div>
<%- include('../partials/foot') %>
`);

// 10. API
write('routes/api.routes.js', `
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/violations/stats', (req, res) => res.json({ stats: [] }));
router.get('/mines', (req, res) => res.json({ mines: [] }));
router.get('/users/officers', (req, res) => res.json({ officers: [] }));
router.get('/sla/check/:violationId', (req, res) => res.json({ status: 'ok' }));
router.get('/dashboard/kpis', (req, res) => res.json({ kpis: {} }));
router.get('/notifications/unread-count', (req, res) => res.json({ count: 0 }));
router.get('/notifications/recent', (req, res) => res.json({ notifications: [] }));

module.exports = router;
`);

// 11. Demo
write('routes/demo.routes.js', `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/demo.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/scenario', controller.getScenario);
router.post('/run', controller.runScenario);
router.post('/reset', controller.resetDemo);
module.exports = router;
`);
write('controllers/demo.controller.js', `
exports.getScenario = async (req, res, next) => res.render('demo/scenario', { title: 'Interactive Demo Simulation', breadcrumb: 'Demo / Scenario' });
exports.runScenario = async (req, res, next) => res.json({ success: true, message: 'Demo completed' });
exports.resetDemo = async (req, res, next) => res.redirect('/demo/scenario');
`);
write('views/demo/scenario.ejs', `
<%- include('../partials/head', { title: title, breadcrumb: breadcrumb }) %>
<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4"><%= title %></h1>
    <button class="bg-blue-600 text-white px-4 py-2 rounded">RUN DEMO SCENARIO</button>
</div>
<%- include('../partials/foot') %>
`);

// 12. Map View
write('views/map/index.ejs', `
<%- include('../partials/head', { title: 'GIS Map', breadcrumb: 'Map' }) %>
<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">GIS Map</h1>
    <div id="map" style="width: 100%; height: 600px;"></div>
</div>
<!-- Load Leaflet JS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<script>
    var map = L.map('map').setView([22.5, 84.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
    
    // Demo markers
    L.marker([23.6, 85.3]).addTo(map).bindPopup('Jharkhand Mine');
    L.marker([21.5, 84.0]).addTo(map).bindPopup('Odisha Mine');
    L.marker([22.0, 82.5]).addTo(map).bindPopup('Chhattisgarh Mine');
    L.marker([23.7, 87.1]).addTo(map).bindPopup('West Bengal Mine');
</script>
<%- include('../partials/foot') %>
`);

console.log("All files created successfully.");
