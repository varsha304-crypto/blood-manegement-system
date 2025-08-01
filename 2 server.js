// ----- server.js -----
// Install: npm i express mongoose body-parser cors nodemailer
const express = require('express'), app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const PORT = 3000;

// UPDATE with your MongoDB URI if using Atlas instead of local
const MONGO_URI = 'mongodb://localhost:27017/extbloodbankms';

// ======== SETUP =========
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ======== MONGOOSE MODELS & CONNECTION ========
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const UserSchema = new mongoose.Schema({
    name: String, email: String, password: String, role: String,
    bloodType: String,
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        city: String
    }
});
UserSchema.index({ location: "2dsphere" });

const InventorySchema = new mongoose.Schema({ bloodType: String, units: Number });
const DonationSchema = new mongoose.Schema({
    donor: String, bloodType: String, status: String, created: { type: Date, default: Date.now }
});
const RequestSchema = new mongoose.Schema({
    recipient: String, bloodType: String, units: Number, status: String, created: { type: Date, default: Date.now },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        city: String
    }
});
const User = mongoose.model('User', UserSchema);
const Inventory = mongoose.model('Inventory', InventorySchema);
const Donation = mongoose.model('Donation', DonationSchema);
const Request = mongoose.model('Request', RequestSchema);

// ======== EMAIL SENDER FUNCTION (GMAIL) ========
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: 'YOUR_EMAIL@gmail.com', pass: 'YOUR_GMAIL_APP_PASSWORD' } // Replace with your Gmail and an App Password
});
async function sendMail(to, subject, text) {
  await transporter.sendMail({ from: '"Blood Bank" <YOUR_EMAIL@gmail.com>', to, subject, text });
}

// ======== HTML HELPERS =========
function htmlBase(title, body, extraHead = '') {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><title>${title}</title>${extraHead}
<style>
body{font-family:sans-serif;background:#f5f6fa;margin:0;}
nav{padding:1em;background:#d35400}
nav a{color:#fff;margin:0 1em;text-decoration:none;font-weight:600}
main{max-width:640px;margin:2em auto;padding:2em;background:#fff;border-radius:10px;box-shadow:0 0 8px #b2bec3;}
label{display:block;margin:1em 0 .2em}
input,select,button{padding:.5em;width:100%;margin-bottom:1em}
button{background:#d35400;color:#fff;border:none;border-radius:5px;}
.form-small{max-width:340px;}
.error{color:red}
.success{color:green}
#map{width:100%;height:200px;margin-bottom:1em;}
</style></head><body>
<nav>
 <a href="/">Home</a>
 <a href="/register">Register</a>
 <a href="/login">Login</a>
 <a href="/request">Request Blood</a>
 <a href="/donate">Donate Blood</a>
 <a href="/admin">Admin</a>
 <a href="/analytics">Analytics</a>
</nav>
<main>
${body}
</main>
</body></html>`
}
function mapLibs(apiKey = 'YOUR_MAPS_API_KEY') {
  return `<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places"></script>`;
}

// ======== FRONTEND PAGES ========

app.get('/', (_, res) => res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Blood Bank Portal</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa;}
header { background: #c0392b; color: #fff; display: flex; align-items: center; padding: 1em 2em; justify-content: space-between;}
.logo { display: flex; align-items: center;}
.logo svg {height: 48px; width: 48px; margin-right: 1em;}
nav a { color: #fff; margin-left: 2em; text-decoration: none; font-weight: bold; letter-spacing: 1px;}
.hero { background:#fff; display:flex; align-items:center; flex-wrap:wrap; padding:3em 2em 2em 2em; border-radius:0 0 24px 24px; box-shadow: 0 3px 12px #e1705550; margin-bottom:2em;}
.hero-img { width: 240px; margin-right: 2em;}
@media(max-width:800px) { .hero { flex-direction: column; align-items: flex-start;} .hero-img { margin:0 0 2em 0; width:160px;}}
.hero-content h1 { margin-top:0; font-size:2.1em;}
.cards { display: flex; justify-content: center; gap:2em; margin-bottom:2em; flex-wrap: wrap;}
.card { background:#fff; border-radius:14px; box-shadow:0 0 10px #cecece77; flex:1; min-width:200px; max-width:260px; padding:1.2em 1.2em; text-align:center; margin: 1em 0 0 0;}
.card a { background: #c0392b; color: #fff; text-decoration: none; font-weight: bold; border-radius: 6px; padding: .5em 1.5em; margin-top:1.2em; display:inline-block; transition: background 0.2s;}
.card a:hover {background: #e74c3c;}
#chart-container { background:#fff;border-radius:14px;box-shadow:0 0 10px #cecece70; padding:2em;max-width:480px;margin:2em auto;}
footer { text-align: center; margin:3em 0 1em 0; color: #7f8c8d;}
  </style>
</head>
<body>
<header>
  <div class="logo">
    <svg viewBox="0 0 64 64"><circle cx="32" cy="45" r="16" fill="#e74c3c"/><path d="M32 6 Q42 24 32 45 Q22 24 32 6Z" fill="#c0392b"/></svg>
    <span style="font-size:1.6em;font-weight: bold;">Blood Bank Portal</span>
  </div>
  <nav>
    <a href="/register">Register</a>
    <a href="/donate">Donate Blood</a>
    <a href="/request">Request Blood</a>
    <a href="/analytics">Analytics</a>
    <a href="/admin">Admin</a>
  </nav>
</header>
<section class="hero">
  <div class="hero-img">
    <svg width="100%" height="100%" viewBox="0 0 180 180" fill="none">
      <ellipse cx="90" cy="150" rx="75" ry="18" fill="#f2c9c9"/>
      <path d="M90,30 Q130,100 90,150 Q50,100 90,30Z" fill="#e74c3c"/>
      <circle cx="90" cy="90" r="23" fill="#fff" opacity="0.15"/>
      <circle cx="90" cy="105" r="8" fill="#fff" opacity="0.17"/>
      <ellipse cx="90" cy="82" rx="7" ry="3.5" fill="#fff" opacity=".23"/>
      <rect x="75" y="120" width="30" height="6" rx="3" fill="#fff" opacity=".11"/>
    </svg>
  </div>
  <div class="hero-content">
    <h1>Every Drop Counts.</h1>
    <p><b>Donate blood, save lives.</b>  
      Our advanced blood bank system helps connect donors and recipients, keeps vital stocks in check, and enables fast, transparent blood requests and donations.<br><br>
      View our current <span style="color:#e74c3c"><b>blood inventory</b></span> below.
    </p>
  </div>
</section>
<div id="chart-container">
  <canvas id="bloodChart" width="300" height="300"></canvas>
</div>
<div class="cards">
  <div class="card">
    <h3>Become a Donor</h3>
    <p>Help your community by donating blood! Every drop saves a life.</p>
    <a href="/donate">Donate Now</a>
  </div>
  <div class="card">
    <h3>Need Blood?</h3>
    <p>Request the blood you need. We match you with suitable donors nearby.</p>
    <a href="/request">Request Blood</a>
  </div>
  <div class="card">
    <h3>View Statistics</h3>
    <p>See donation rates and demand trends in your community.</p>
    <a href="/analytics">See Analytics</a>
  </div>
</div>
<footer>
  &copy; 2025 Blood Bank Portal &mdash; <span>Bringing hope, one donation at a time.</span>
</footer>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
fetch('/api/inventory')
  .then(res => res.json())
  .then(data => {
    const types = data.map(d => d.bloodType);
    const units = data.map(d => d.units);
    const colors = [
      "#e74c3c","#c0392b","#ad1457","#d35400","#f1c40f",
      "#16a085","#27ae60","#2980b9"
    ];
    new Chart(document.getElementById("bloodChart").getContext("2d"), {
      type: 'pie',
      data: {
        labels: types,
        datasets: [{
          data: units,
          backgroundColor: colors
        }]
      },
      options: {
        plugins: {
          legend: { display: true, position: 'bottom' }
        }
      }
    });
  });
</script>
</body>
</html>
`));

// ------- (register, login, request, donate, admin, analytics routes as in your original code) -------
// -- Copy the HTML helpers and all API endpoints from your sample above. To preserve space, not repeated here --
// The previous answer already includes the HTML frontend and all API endpoints for /register, /login, /request, /donate, /admin, /analytics pages 
// along with the MongoDB models and APIs: /api/register, /api/login, /api/inventory, /api/request, /api/match-donors, /api/donate, /api/requests/pending, /api/request/:id/:status, /api/donations/pending, /api/donate/:id/:status, /api/analytics/donations, /api/analytics/requests.

// --------- Initial Data Seeding ---------
Inventory.countDocuments().then(n => {
    if(n === 0) Inventory.insertMany([
        {bloodType:'A+',units:5},
        {bloodType:'B+',units:2},
        {bloodType:'O-',units:1},
        {bloodType:'AB+',units:0}
    ]);
});

// --------- Start Server ----------
app.listen(PORT, () => console.log("Blood bank system running on http://localhost:" + PORT));
