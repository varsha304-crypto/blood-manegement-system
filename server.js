// ----- server.js -----
// Install: npm i express mongoose body-parser cors nodemailer
const express = require('express'), app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const PORT = 3000;
const MONGO_URI = 'mongodb://localhost:27017/extbloodbankms'; // Set to your local or Atlas Mongo URI

// ======== SETUP =========
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ======== MONGOOSE MODELS ========
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
  auth: { user: 'YOUR_EMAIL@gmail.com', pass: 'YOUR_GMAIL_APP_PASSWORD' } // Replace these
});
async function sendMail(to, subject, text) {
  await transporter.sendMail({ from: '"Blood Bank" <YOUR_EMAIL@gmail.com>', to, subject, text });
}

// ======== HTML HELPERS (SPLIT PAGES) ========
function htmlBase(title, body, extraHead = '') {
  // Simpler style for clarity
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
body {
    margin: 0;
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #f5f6fa;
}
header {
    background: #c0392b;
    color: #fff;
    display: flex;
    align-items: center;
    padding: 1em 2em;
    justify-content: space-between;
}
.logo {
    display: flex;
    align-items: center;
}
.logo svg {
    height: 48px;
    width: 48px;
    margin-right: 1em;
}
nav a {
    color: #fff;
    margin-left: 2em;
    text-decoration: none;
    font-weight: bold;
    letter-spacing: 1px;
}
.hero {
    background:#fff;
    display:flex;
    align-items:center;
    flex-wrap:wrap;
    padding:3em 2em 2em 2em;
    border-radius:0 0 24px 24px;
    box-shadow: 0 3px 12px #e1705550;
    margin-bottom:2em;
}
.hero-img {
    width: 240px; 
    margin-right: 2em;
}
@media(max-width:800px) {
    .hero { flex-direction: column; align-items: flex-start;}
    .hero-img { margin:0 0 2em 0; width:160px;}
}
.hero-content h1 { margin-top:0; font-size:2.1em;}
.cards {
    display: flex; justify-content: center; gap:2em; margin-bottom:2em; 
    flex-wrap: wrap;
}
.card {
    background:#fff; border-radius:14px; box-shadow:0 0 10px #cecece77;
    flex:1; min-width:200px; max-width:260px; padding:1.2em 1.2em; text-align:center; 
    margin: 1em 0 0 0;
}
.card a {
    background: #c0392b;
    color: #fff;
    text-decoration: none;
    font-weight: bold;
    border-radius: 6px;
    padding: .5em 1.5em;
    margin-top:1.2em;
    display:inline-block;
    transition: background 0.2s;
}
.card a:hover {background: #e74c3c;}
#chart-container {
    background:#fff;border-radius:14px;box-shadow:0 0 10px #cecece70;
    padding:2em;max-width:480px;margin:2em auto;
}
footer {
    text-align: center; margin:3em 0 1em 0; color: #7f8c8d;
}
  </style>
</head>
<body>
<header>
  <div class="logo">
    <!-- Blood Drop SVG -->
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
    <!-- Medical/Blood Hero Illustration SVG -->
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
    <p>
      <b>Donate blood, save lives.</b>  
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


app.get('/register', (_, res) => res.send(htmlBase("Register",
`<h2>User Registration</h2>
<form id="regForm" class="form-small">
<label>Name</label><input name="name" required>
<label>Email</label><input name="email" required type="email">
<label>Password</label><input name="password" required type="password">
<label>Role</label>
<select name="role"><option>donor</option><option>recipient</option></select>
<label>Blood Type</label><select name="bloodType">
<option>A+</option><option>A-</option><option>B+</option><option>B-</option>
<option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
</select>
<label>City</label><input name="city" id="city" required>
<label>Select Location on Map:</label>
<input id="address" placeholder="Type address for quick selection"><div id="map"></div>
<input type="hidden" id="latlng" name="latlng">
<button type="submit">Register</button>
</form>
<div id="msg"></div>
${mapLibs()}
<script>
let marker,lat=0,lng=0;
function initMap(){
   let map=new google.maps.Map(document.getElementById('map'),{center:{lat:19.1,lng:72.9},zoom:10});
   map.addListener('click',e=>{
     lat=e.latLng.lat();lng=e.latLng.lng();
     if(marker)marker.setMap(null);
     marker=new google.maps.Marker({position:e.latLng,map});
     document.getElementById('latlng').value=lat+','+lng;
   });
   let autocomplete=new google.maps.places.Autocomplete(document.getElementById('address'));
   autocomplete.addListener('place_changed',function(){
     let p=autocomplete.getPlace();
     let loc=p.geometry.location;
     lat=loc.lat();lng=loc.lng();
     map.panTo(loc);
     if(marker)marker.setMap(null); marker=new google.maps.Marker({position:loc,map});
     document.getElementById('latlng').value=lat+','+lng;
   });
}
window.onload=initMap;
document.getElementById('regForm').onsubmit=async e=>{
 e.preventDefault();
 let d=new FormData(e.target);
 let coords=(d.get('latlng')||'').split(',');
 let body={
  name:d.get('name'), email:d.get('email'), password:d.get('password'), role:d.get('role'),
  bloodType:d.get('bloodType'), location:{type:'Point',coordinates:[parseFloat(coords[1]),parseFloat(coords[0])],city:d.get('city')}
 };
 let r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 document.getElementById('msg').innerText=await r.text();
};
</script>
`)));

app.get('/login', (_, res) => res.send(htmlBase("Login",
`<h2>User Login</h2>
<form id="loginForm" class="form-small">
<label>Email</label><input name="email" required type="email">
<label>Password</label><input name="password" required type="password">
<label>Role</label><select name="role"><option>donor</option><option>recipient</option><option>admin</option></select>
<button type="submit">Login</button>
</form>
<div id="msg"></div>
<script>
document.getElementById('loginForm').onsubmit=async e=>{
 e.preventDefault();
 let d=new FormData(e.target);
 let body={email:d.get('email'),password:d.get('password'),role:d.get('role')};
 let r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 let u=await r.json();
 document.getElementById('msg').innerText=(u.email)?('Welcome, '+u.name):"Invalid credentials";
 if(u.role==="admin") window.location='/admin';
};
</script>
`)));

app.get('/request', (_, res) => res.send(htmlBase("Request Blood", `
<h2>Request Blood</h2>
<form id="reqForm" class="form-small">
<label>Recipient Email</label><input name="recipient" required type="email">
<label>Blood Type</label>
<select name="bloodType">
<option>A+</option><option>A-</option><option>B+</option><option>B-</option>
<option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
</select>
<label>Units</label><input name="units" required min="1" type="number">
<label>City</label><input name="city" required>
<label>Select Location (for geo-matching):</label>
<input id="address" placeholder="Type address for quick selection"><div id="map"></div>
<input type="hidden" id="latlng" name="latlng">
<button type="submit">Request</button>
</form>
<div id="msg"></div>
<h3>Nearby Donors of this Type:</h3>
<div id="matches"></div>
${mapLibs()}
<script>
let marker,lat=0,lng=0;
function initMap(){
   let map=new google.maps.Map(document.getElementById('map'),{center:{lat:19.1,lng:72.9},zoom:10});
   map.addListener('click',e=>{
     lat=e.latLng.lat();lng=e.latLng.lng();
     if(marker)marker.setMap(null);
     marker=new google.maps.Marker({position:e.latLng,map});
     document.getElementById('latlng').value=lat+','+lng;
   });
   let autocomplete=new google.maps.places.Autocomplete(document.getElementById('address'));
   autocomplete.addListener('place_changed',function(){
     let p=autocomplete.getPlace();
     let loc=p.geometry.location;
     lat=loc.lat();lng=loc.lng();
     map.panTo(loc);
     if(marker)marker.setMap(null); marker=new google.maps.Marker({position:loc,map});
     document.getElementById('latlng').value=lat+','+lng;
   });
}
window.onload=initMap;
document.getElementById('reqForm').onsubmit=async e=>{
 e.preventDefault();
 let d=new FormData(e.target);
 let coords=(d.get('latlng')||'').split(',');
 let body={
  recipient:d.get('recipient'), bloodType:d.get('bloodType'), units:d.get('units'),
  location:{type:'Point',coordinates:[parseFloat(coords[1]),parseFloat(coords[0])],city:d.get('city')}
 };
 let r=await fetch('/api/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 document.getElementById('msg').innerText=await r.text();
 // Show geo-matching donors
 let matches=await fetch('/api/match-donors?lat='+coords[0]+'&lng='+coords[1]+'&type='+d.get('bloodType')).then(x=>x.json());
 document.getElementById('matches').innerHTML=matches.map(x=>x.name+' ('+x.city+') - '+x.email).join('<br>');
};
</script>
`)));

app.get('/donate', (_, res) => res.send(htmlBase("Donate Blood",
`<h2>Schedule Blood Donation</h2>
<form id="donForm" class="form-small">
<label>Donor Email</label><input name="donor" required type="email">
<label>Blood Type</label>
<select name="bloodType">
<option>A+</option><option>A-</option><option>B+</option><option>B-</option>
<option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
</select>
<button type="submit">Donate</button>
</form>
<div id="msg"></div>
<script>
document.getElementById('donForm').onsubmit=async e=>{
 e.preventDefault();
 let d=new FormData(e.target), body={donor:d.get('donor'),bloodType:d.get('bloodType')};
 let r=await fetch('/api/donate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 document.getElementById('msg').innerText=await r.text();
};
</script>
`)));

app.get('/admin', (_, res) => res.send(htmlBase("Admin Panel",`
<h2>Admin: Manage Blood Bank</h2>
<h3>Pending Requests</h3>
<div id="reqs"></div>
<h3>Pending Donations</h3>
<div id="dons"></div>
<h3>Set Inventory</h3>
<form id="invForm" class="form-small">
<label>Blood Type</label>
<select name="bloodType">
<option>A+</option><option>A-</option><option>B+</option><option>B-</option>
<option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
</select>
<label>Units</label><input name="units" type="number" min="0">
<button type="submit">Set</button>
</form><div id="invMsg"></div>
<script>
function renderReqs(){
 fetch('/api/requests/pending').then(x=>x.json()).then(arr=>{
   document.getElementById('reqs').innerHTML=arr.map(r=>\`<div>
   \${r.recipient} requests \${r.units} unit(s) of \${r.bloodType} (\${r.city}) [\${r.status}]
   <button onclick="act('\${r._id}','approved')">Approve</button>
   <button onclick="act('\${r._id}','rejected')">Reject</button>
   </div>\`).join('');
 });
}
function renderDons(){
 fetch('/api/donations/pending').then(x=>x.json()).then(arr=>{
   document.getElementById('dons').innerHTML=arr.map(d=>\`<div>
   \${d.donor} offers \${d.bloodType} [\${d.status}]
   <button onclick="actDon('\${d._id}','approved')">Approve</button>
   <button onclick="actDon('\${d._id}','rejected')">Reject</button>
   </div>\`).join('');
 });
}
window.onload=()=>{renderReqs();renderDons()};
window.act=async(id,st)=>{await fetch('/api/request/'+id+'/'+st,{method:'POST'});renderReqs();}
window.actDon=async(id,st)=>{await fetch('/api/donate/'+id+'/'+st,{method:'POST'});renderDons();}
document.getElementById('invForm').onsubmit=async e=>{
 e.preventDefault();
 let d=new FormData(e.target);
 let body={bloodType:d.get('bloodType'),units:parseInt(d.get('units'))};
 let r=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 document.getElementById('invMsg').innerText=await r.text();
};
</script>
`)));

app.get('/analytics', (_, res) => res.send(htmlBase("Analytics",
`<h2>Donation & Request Trends</h2>
<canvas id="donChart" width="300" height="120"></canvas>
<canvas id="reqChart" width="300" height="120"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
fetch('/api/analytics/donations').then(r=>r.json()).then(d=>{
  let labels=d.map(x=>x._id.month+'/'+x._id.year), vals=d.map(x=>x.total);
  new Chart(document.getElementById('donChart').getContext('2d'),{type:'line',data:{labels,datasets:[{label:'Donations/month',data:vals,borderColor:'red',fill:false}]}})
});
fetch('/api/analytics/requests').then(r=>r.json()).then(d=>{
  let labels=d.map(x=>x._id.month+'/'+x._id.year), vals=d.map(x=>x.total);
  new Chart(document.getElementById('reqChart').getContext('2d'),{type:'line',data:{labels,datasets:[{label:'Requests/month',data:vals,borderColor:'blue',fill:false}]}})
});
</script>
`)));

// ========== APIs ==========

app.post('/api/register', async (req,res)=>{
  let {name,email,password,role,bloodType,location}=req.body;
  if(!name||!email||!password||!role||!bloodType||!location||!location.coordinates) 
    return res.status(400).send("All fields required");
  let ext=await User.findOne({email});
  if(ext) return res.status(400).send("Email exists");
  let user = new User({name,email,password,role,bloodType,location});
  await user.save();
  res.send("Registration successful");
});

app.post('/api/login', async (req,res)=>{
  let {email,password,role}=req.body;
  let u=await User.findOne({email,password,role});
  if(!u) return res.status(401).send({});
  res.json({name:u.name,email:u.email,role:u.role,city:u.location.city});
});

// Inventory GET/POST
app.get('/api/inventory', async (_,res)=>{res.json(await Inventory.find())});
app.post('/api/inventory', async (req,res)=>{
  let {bloodType,units}=req.body;
  let inv=await Inventory.findOne({bloodType});
  if(inv){inv.units=units;await inv.save();res.send("Inventory updated.");}
  else{await new Inventory({bloodType,units}).save();res.send("Added new blood group.");}
});

// Blood Request with location
app.post('/api/request', async (req,res)=>{
  let {recipient,bloodType,units,location}=req.body;
  if(!recipient||!bloodType||!units||!location||!location.coordinates) return res.status(400).send("All fields required");
  await new Request({recipient,bloodType,units,status:'pending',location}).save();
  res.send("Blood request submitted");
});

// Donor geo-matching: find donors of same type within 50km
app.get('/api/match-donors', async (req,res)=>{
  let {lat,lng,type} = req.query;
  if(!lat||!lng||!type) return res.json([]);
  let donors=await User.find({
    role:'donor', bloodType:type,
    location:{$near:{$geometry:{type:'Point',coordinates:[parseFloat(lng),parseFloat(lat)]},$maxDistance:50000}}
  }).select('name email location.city');
  res.json(donors);
});

app.post('/api/donate', async (req,res)=>{
  let {donor,bloodType}=req.body;
  if(!donor||!bloodType) return res.status(400).send("All fields required");
  await new Donation({donor,bloodType,status:'pending'}).save();
  res.send("Donation scheduled");
});

// -- Admin APIs: get pending, approve/reject, send email on approval --
app.get('/api/requests/pending', async (_,res)=>res.json(await Request.find({status:'pending'})));
app.post('/api/request/:id/:status', async (req,res)=>{
 let doc=await Request.findByIdAndUpdate(req.params.id,{status:req.params.status},{new:true});
 if(req.params.status==='approved'){
   let user = await User.findOne({email:doc.recipient});
   if(user) await sendMail(user.email,'Blood Request Approved',`Your request for ${doc.bloodType} units is approved!`);
 }
 res.send('OK');
});

app.get('/api/donations/pending', async (_,res)=>res.json(await Donation.find({status:'pending'})));
app.post('/api/donate/:id/:status', async (req,res)=>{
 let doc=await Donation.findByIdAndUpdate(req.params.id,{status:req.params.status},{new:true});
 if(req.params.status==='approved'){
   let user = await User.findOne({email:doc.donor});
   if(user) await sendMail(user.email,'Donation Approved','Your donation has been approved, thank you!');
 }
 res.send('OK');
});

// ---- Analytics -----
app.get('/api/analytics/donations', async (req,res)=>{
  let pipe=[
    { $group:{ _id:{month:{$month:"$created"},year:{$year:"$created"}},total:{$sum:1} } },
    { $sort:{ "_id.year":1, "_id.month":1 } }
  ];
  res.json(await Donation.aggregate(pipe));
});
app.get('/api/analytics/requests', async (req,res)=>{
  let pipe=[
    { $group:{ _id:{month:{$month:"$created"},year:{$year:"$created"}},total:{$sum:1} } },
    { $sort:{ "_id.year":1, "_id.month":1 } }
  ];
  res.json(await Request.aggregate(pipe));
});

// -- Seed initial inventory --
Inventory.countDocuments().then(n=>{
  if(n===0) Inventory.insertMany([
    {bloodType:'A+',units:5},{bloodType:'B+',units:2},
    {bloodType:'O-',units:1},{bloodType:'AB+',units:0}
  ]);
});

app.listen(PORT, ()=>console.log("Blood bank system running on http://localhost:"+PORT)); 