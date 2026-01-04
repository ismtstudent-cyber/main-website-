const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const crypto = require('crypto');
require('dotenv').config();
const USE_DB = process.env.USE_DB === 'true';

let db;
let runAsync, allAsync, getAsync;
if (USE_DB) {
  const sqlite3 = require('sqlite3').verbose();
  const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');
  db = new sqlite3.Database(DB_PATH);
  runAsync = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) {
    if (err) return reject(err);
    resolve(this);
  }));
  allAsync = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  }));
  getAsync = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
  }));
}

const app = express();
const PORT = process.env.PORT || 3000;

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILES = {
  projects: path.join(DATA_DIR, 'projects.json'),
  team: path.join(DATA_DIR, 'team.json'),
  testimonials: path.join(DATA_DIR, 'testimonials.json'),
  blog: path.join(DATA_DIR, 'blog.json'),
  faq: path.join(DATA_DIR, 'faq.json'),
  services: path.join(DATA_DIR, 'services.json'),
  admin: path.join(DATA_DIR, 'admin.json')
};

// Initialize data directory and files
async function initializeDataFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    if (USE_DB) {
      // Initialize SQLite tables. We'll store each record as JSON text for flexibility.
      const tables = Object.keys(DATA_FILES).map(k => k).filter(k => k !== 'admin');
      for (const t of tables) {
        const tableName = `tbl_${t}`;
        await runAsync(`CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, json TEXT)`);
      }

      // Admin table
      await runAsync(`CREATE TABLE IF NOT EXISTS tbl_admin (id TEXT PRIMARY KEY, json TEXT)`);

      // Ensure admin row exists
      const adminRow = await getAsync(`SELECT json FROM tbl_admin WHERE id = ?`, ['admin']);
      if (!adminRow) {
        const defaultAdmin = {
          username: 'admin',
          password: crypto.createHash('sha256').update('admin123').digest('hex')
        };
        await runAsync(`INSERT INTO tbl_admin (id, json) VALUES (?, ?)`, ['admin', JSON.stringify(defaultAdmin)]);
        console.log('Default admin credentials: username: admin, password: admin123');
      }
    } else {
      // File-based fallback
      for (const [key, filePath] of Object.entries(DATA_FILES)) {
        if (key === 'admin') {
          // Admin file with default credentials
          try {
            await fs.access(filePath);
          } catch {
            const defaultAdmin = {
              username: 'admin',
              password: crypto.createHash('sha256').update('admin123').digest('hex')
            };
            await fs.writeFile(filePath, JSON.stringify(defaultAdmin, null, 2));
            console.log('Default admin credentials: username: admin, password: admin123');
          }
        } else {
          try {
            await fs.access(filePath);
          } catch {
            await fs.writeFile(filePath, JSON.stringify([], null, 2));
          }
        }
      }
    }
  } catch (error) {
    console.error('Error initializing data files:', error);
  }
}

initializeDataFiles();

// Helper functions for data operations
async function readData(key) {
  try {
    const data = await fs.readFile(DATA_FILES[key], 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (USE_DB) {
      try {
        if (key === 'admin') {
          const row = await getAsync(`SELECT json FROM tbl_admin WHERE id = ?`, ['admin']);
          return row ? JSON.parse(row.json) : null;
        }
        const tableName = `tbl_${key}`;
        const rows = await allAsync(`SELECT json FROM ${tableName}`);
        return rows.map(r => JSON.parse(r.json));
      } catch (err) {
        return key === 'admin' ? null : [];
      }
    }
    return key === 'admin' ? null : [];
  }
}

async function writeData(key, data) {
  if (USE_DB) {
    if (key === 'admin') {
      await runAsync(`REPLACE INTO tbl_admin (id, json) VALUES (?, ?)`, ['admin', JSON.stringify(data)]);
      return;
    }
    const tableName = `tbl_${key}`;
    // replace all rows: simple approach - delete existing and insert new
    await runAsync(`DELETE FROM ${tableName}`);
    for (const item of data) {
      const id = item.id || crypto.randomBytes(16).toString('hex');
      const toInsert = { ...item, id };
      await runAsync(`INSERT OR REPLACE INTO ${tableName} (id, json) VALUES (?, ?)`, [id, JSON.stringify(toInsert)]);
    }
    return;
  }
  await fs.writeFile(DATA_FILES[key], JSON.stringify(data, null, 2));
}

// Simple token generation and verification
const activeTokens = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function verifyToken(token) {
  return activeTokens.has(token);
}

// Authentication middleware
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
  
  next();
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
  credentials: true
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  
  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ 
      success: false, 
      message: 'Name, email, and message are required fields.' 
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide a valid email address.' 
    });
  }

  // In production, integrate with email service (SendGrid, AWS SES, etc.)
  // For now, log the contact form submission
  console.log('Contact Form Submission:', {
    name,
    email,
    phone,
    subject,
    message,
    timestamp: new Date().toISOString()
  });

  res.json({ 
    success: true, 
    message: 'Thank you for contacting us! We will get back to you soon.' 
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin API Routes
// Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Admin login attempt:', { username });
    const adminData = await readData('admin');
    if (!adminData) {
      console.error('Admin data not found during login');
      return res.status(500).json({ success: false, message: 'Admin data not found on server' });
    }
    
    if (!adminData || adminData.username !== username) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (adminData.password !== passwordHash) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = generateToken();
    activeTokens.set(token, { username, timestamp: Date.now() });
    
    // Clean up old tokens (older than 24 hours)
    const now = Date.now();
    for (const [t, data] of activeTokens.entries()) {
      if (now - data.timestamp > 24 * 60 * 60 * 1000) {
        activeTokens.delete(t);
      }
    }
    
    res.json({ success: true, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Stats
app.get('/api/admin/stats', authenticate, async (req, res) => {
  try {
    const projects = await readData('projects');
    const team = await readData('team');
    const testimonials = await readData('testimonials');
    const blog = await readData('blog');
    
    res.json({
      projects: projects.length || 0,
      team: team.length || 0,
      testimonials: testimonials.length || 0,
      blog: blog.length || 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

// Projects CRUD
app.get('/api/admin/projects', authenticate, async (req, res) => {
  try {
    const projects = await readData('projects');
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching projects' });
  }
});

app.get('/api/admin/projects/:id', authenticate, async (req, res) => {
  try {
    const projects = await readData('projects');
    const project = projects.find(p => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching project' });
  }
});

app.post('/api/admin/projects', authenticate, async (req, res) => {
  try {
    const projects = await readData('projects');
    const newProject = {
      id: crypto.randomBytes(16).toString('hex'),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    projects.push(newProject);
    await writeData('projects', projects);
    res.json({ success: true, project: newProject });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating project' });
  }
});

app.put('/api/admin/projects/:id', authenticate, async (req, res) => {
  try {
    const projects = await readData('projects');
    const index = projects.findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    projects[index] = { ...projects[index], ...req.body, updatedAt: new Date().toISOString() };
    await writeData('projects', projects);
    res.json({ success: true, project: projects[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating project' });
  }
});

app.delete('/api/admin/projects/:id', authenticate, async (req, res) => {
  try {
    const projects = await readData('projects');
    const filtered = projects.filter(p => p.id !== req.params.id);
    if (filtered.length === projects.length) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    await writeData('projects', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting project' });
  }
});

// Team CRUD
app.get('/api/admin/team', authenticate, async (req, res) => {
  try {
    const team = await readData('team');
    res.json({ success: true, team });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching team' });
  }
});

app.get('/api/admin/team/:id', authenticate, async (req, res) => {
  try {
    const team = await readData('team');
    const member = team.find(m => m.id === req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    res.json({ success: true, member });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching team member' });
  }
});

app.post('/api/admin/team', authenticate, async (req, res) => {
  try {
    const team = await readData('team');
    const newMember = {
      id: crypto.randomBytes(16).toString('hex'),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    team.push(newMember);
    await writeData('team', team);
    res.json({ success: true, member: newMember });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating team member' });
  }
});

app.put('/api/admin/team/:id', authenticate, async (req, res) => {
  try {
    const team = await readData('team');
    const index = team.findIndex(m => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    team[index] = { ...team[index], ...req.body, updatedAt: new Date().toISOString() };
    await writeData('team', team);
    res.json({ success: true, member: team[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating team member' });
  }
});

app.delete('/api/admin/team/:id', authenticate, async (req, res) => {
  try {
    const team = await readData('team');
    const filtered = team.filter(m => m.id !== req.params.id);
    if (filtered.length === team.length) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    await writeData('team', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting team member' });
  }
});

// Testimonials CRUD
app.get('/api/admin/testimonials', authenticate, async (req, res) => {
  try {
    const testimonials = await readData('testimonials');
    res.json({ success: true, testimonials });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching testimonials' });
  }
});

app.get('/api/admin/testimonials/:id', authenticate, async (req, res) => {
  try {
    const testimonials = await readData('testimonials');
    const testimonial = testimonials.find(t => t.id === req.params.id);
    if (!testimonial) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }
    res.json({ success: true, testimonial });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching testimonial' });
  }
});

app.post('/api/admin/testimonials', authenticate, async (req, res) => {
  try {
    const testimonials = await readData('testimonials');
    const newTestimonial = {
      id: crypto.randomBytes(16).toString('hex'),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    testimonials.push(newTestimonial);
    await writeData('testimonials', testimonials);
    res.json({ success: true, testimonial: newTestimonial });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating testimonial' });
  }
});

app.put('/api/admin/testimonials/:id', authenticate, async (req, res) => {
  try {
    const testimonials = await readData('testimonials');
    const index = testimonials.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }
    testimonials[index] = { ...testimonials[index], ...req.body, updatedAt: new Date().toISOString() };
    await writeData('testimonials', testimonials);
    res.json({ success: true, testimonial: testimonials[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating testimonial' });
  }
});

app.delete('/api/admin/testimonials/:id', authenticate, async (req, res) => {
  try {
    const testimonials = await readData('testimonials');
    const filtered = testimonials.filter(t => t.id !== req.params.id);
    if (filtered.length === testimonials.length) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }
    await writeData('testimonials', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting testimonial' });
  }
});

// Blog CRUD
app.get('/api/admin/blog', authenticate, async (req, res) => {
  try {
    const blog = await readData('blog');
    res.json({ success: true, posts: blog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching blog posts' });
  }
});

app.get('/api/admin/blog/:id', authenticate, async (req, res) => {
  try {
    const blog = await readData('blog');
    const post = blog.find(b => b.id === req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching blog post' });
  }
});

app.post('/api/admin/blog', authenticate, async (req, res) => {
  try {
    const blog = await readData('blog');
    const newPost = {
      id: crypto.randomBytes(16).toString('hex'),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    blog.push(newPost);
    await writeData('blog', blog);
    res.json({ success: true, post: newPost });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating blog post' });
  }
});

app.put('/api/admin/blog/:id', authenticate, async (req, res) => {
  try {
    const blog = await readData('blog');
    const index = blog.findIndex(b => b.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }
    blog[index] = { ...blog[index], ...req.body, updatedAt: new Date().toISOString() };
    await writeData('blog', blog);
    res.json({ success: true, post: blog[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating blog post' });
  }
});

app.delete('/api/admin/blog/:id', authenticate, async (req, res) => {
  try {
    const blog = await readData('blog');
    const filtered = blog.filter(b => b.id !== req.params.id);
    if (filtered.length === blog.length) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }
    await writeData('blog', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting blog post' });
  }
});

// FAQ CRUD
app.get('/api/admin/faq', authenticate, async (req, res) => {
  try {
    const faq = await readData('faq');
    res.json({ success: true, faqs: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching FAQs' });
  }
});

app.get('/api/admin/faq/:id', authenticate, async (req, res) => {
  try {
    const faq = await readData('faq');
    const item = faq.find(f => f.id === req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }
    res.json({ success: true, faq: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching FAQ' });
  }
});

app.post('/api/admin/faq', authenticate, async (req, res) => {
  try {
    const faq = await readData('faq');
    const newFaq = {
      id: crypto.randomBytes(16).toString('hex'),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    faq.push(newFaq);
    await writeData('faq', faq);
    res.json({ success: true, faq: newFaq });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating FAQ' });
  }
});

app.put('/api/admin/faq/:id', authenticate, async (req, res) => {
  try {
    const faq = await readData('faq');
    const index = faq.findIndex(f => f.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }
    faq[index] = { ...faq[index], ...req.body, updatedAt: new Date().toISOString() };
    await writeData('faq', faq);
    res.json({ success: true, faq: faq[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating FAQ' });
  }
});

app.delete('/api/admin/faq/:id', authenticate, async (req, res) => {
  try {
    const faq = await readData('faq');
    const filtered = faq.filter(f => f.id !== req.params.id);
    if (filtered.length === faq.length) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }
    await writeData('faq', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting FAQ' });
  }
});

// Services CRUD
app.get('/api/admin/services', authenticate, async (req, res) => {
  try {
    const services = await readData('services');
    res.json({ success: true, services });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching services' });
  }
});

app.get('/api/admin/services/:id', authenticate, async (req, res) => {
  try {
    const services = await readData('services');
    const service = services.find(s => s.id === req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, service });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching service' });
  }
});

app.post('/api/admin/services', authenticate, async (req, res) => {
  try {
    const services = await readData('services');
    const newService = {
      id: crypto.randomBytes(16).toString('hex'),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    services.push(newService);
    await writeData('services', services);
    res.json({ success: true, service: newService });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating service' });
  }
});

app.put('/api/admin/services/:id', authenticate, async (req, res) => {
  try {
    const services = await readData('services');
    const index = services.findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    services[index] = { ...services[index], ...req.body, updatedAt: new Date().toISOString() };
    await writeData('services', services);
    res.json({ success: true, service: services[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating service' });
  }
});

app.delete('/api/admin/services/:id', authenticate, async (req, res) => {
  try {
    const services = await readData('services');
    const filtered = services.filter(s => s.id !== req.params.id);
    if (filtered.length === services.length) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    await writeData('services', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting service' });
  }
});

// Change Password
app.post('/api/admin/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminData = await readData('admin');
    
    const currentHash = crypto.createHash('sha256').update(currentPassword).digest('hex');
    if (adminData.password !== currentHash) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    
    const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    adminData.password = newHash;
    await writeData('admin', adminData);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;

