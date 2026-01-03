// Admin Panel JavaScript

// State management
let currentSection = 'dashboard';
let editingId = null;

// API Base URL
const API_BASE = '/api/admin';

// Check authentication
function checkAuth() {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        showLoginScreen();
    } else {
        showAdminPanel();
        loadDashboard();
    }
}

// Show/Hide screens
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
}

// Login functionality
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const messageEl = document.getElementById('loginMessage');

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            sessionStorage.setItem('adminToken', data.token);
            showAdminPanel();
            loadDashboard();
            messageEl.className = 'message';
            messageEl.textContent = '';
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = data.message || 'Invalid credentials';
        }
    } catch (error) {
        messageEl.className = 'message error';
        messageEl.textContent = 'Login failed. Please try again.';
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('adminToken');
    showLoginScreen();
});

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const section = item.getAttribute('data-section');
        switchSection(section);
    });
});

function switchSection(section) {
    currentSection = section;
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === section) {
            item.classList.add('active');
        }
    });
    
    // Update content
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(section).classList.add('active');
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        projects: 'Projects',
        team: 'Team Members',
        testimonials: 'Testimonials',
        blog: 'Blog Posts',
        faq: 'FAQ',
        services: 'Services',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Admin Panel';
    
    // Load section data
    if (section === 'dashboard') {
        loadDashboard();
    } else if (section === 'projects') {
        loadProjects();
    } else if (section === 'team') {
        loadTeam();
    } else if (section === 'testimonials') {
        loadTestimonials();
    } else if (section === 'blog') {
        loadBlog();
    } else if (section === 'faq') {
        loadFAQ();
    } else if (section === 'services') {
        loadServices();
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('statProjects').textContent = data.projects || 0;
            document.getElementById('statTeam').textContent = data.team || 0;
            document.getElementById('statTestimonials').textContent = data.testimonials || 0;
            document.getElementById('statBlog').textContent = data.blog || 0;
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Projects
document.getElementById('addProjectBtn')?.addEventListener('click', () => {
    openProjectModal();
});

async function loadProjects() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/projects`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        const listEl = document.getElementById('projectsList');
        if (data.success && data.projects) {
            if (data.projects.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💼</div><h3>No projects yet</h3><p>Add your first project to get started</p></div>';
            } else {
                listEl.innerHTML = data.projects.map(project => `
                    <div class="item-card">
                        <div class="item-content">
                            <div class="item-title">${escapeHtml(project.title)}</div>
                            <div class="item-description">${escapeHtml(project.description)}</div>
                            <div class="item-meta">
                                ${project.tags ? project.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('') : ''}
                            </div>
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-secondary btn-sm" onclick="editProject('${project.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteProject('${project.id}')">Delete</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function openProjectModal(id = null) {
    editingId = id;
    const modal = document.getElementById('projectModal');
    const form = document.getElementById('projectForm');
    const titleEl = document.getElementById('projectModalTitle');
    
    titleEl.textContent = id ? 'Edit Project' : 'Add Project';
    form.reset();
    document.getElementById('projectId').value = id || '';
    
    if (id) {
        // Load project data
        loadProjectData(id);
    }
    
    modal.classList.add('active');
}

async function loadProjectData(id) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/projects/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.project) {
            const p = data.project;
            document.getElementById('projectTitle').value = p.title || '';
            document.getElementById('projectDescription').value = p.description || '';
            document.getElementById('projectImage').value = p.image || '';
            document.getElementById('projectTags').value = p.tags ? p.tags.join(', ') : '';
            document.getElementById('projectLink').value = p.link || '';
        }
    } catch (error) {
        console.error('Error loading project:', error);
    }
}

window.editProject = function(id) {
    openProjectModal(id);
};

window.deleteProject = async function(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/projects/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            loadProjects();
            loadDashboard();
        } else {
            alert(data.message || 'Error deleting project');
        }
    } catch (error) {
        alert('Error deleting project');
    }
};

document.getElementById('projectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('adminToken');
    const id = document.getElementById('projectId').value;
    const formData = {
        title: document.getElementById('projectTitle').value,
        description: document.getElementById('projectDescription').value,
        image: document.getElementById('projectImage').value,
        tags: document.getElementById('projectTags').value.split(',').map(t => t.trim()).filter(t => t),
        link: document.getElementById('projectLink').value
    };
    
    try {
        const url = id ? `${API_BASE}/projects/${id}` : `${API_BASE}/projects`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        if (data.success) {
            closeModal('projectModal');
            loadProjects();
            loadDashboard();
        } else {
            alert(data.message || 'Error saving project');
        }
    } catch (error) {
        alert('Error saving project');
    }
});

// Team Members
document.getElementById('addTeamBtn')?.addEventListener('click', () => {
    openTeamModal();
});

async function loadTeam() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/team`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        const listEl = document.getElementById('teamList');
        if (data.success && data.team) {
            if (data.team.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No team members yet</h3><p>Add your first team member to get started</p></div>';
            } else {
                listEl.innerHTML = data.team.map(member => `
                    <div class="item-card">
                        <div class="item-content">
                            <div class="item-title">${escapeHtml(member.name)}</div>
                            <div class="item-description">${escapeHtml(member.role)}</div>
                            ${member.bio ? `<div class="item-description">${escapeHtml(member.bio)}</div>` : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-secondary btn-sm" onclick="editTeam('${member.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteTeam('${member.id}')">Delete</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading team:', error);
    }
}

function openTeamModal(id = null) {
    editingId = id;
    const modal = document.getElementById('teamModal');
    const form = document.getElementById('teamForm');
    const titleEl = document.getElementById('teamModalTitle');
    
    titleEl.textContent = id ? 'Edit Team Member' : 'Add Team Member';
    form.reset();
    document.getElementById('teamId').value = id || '';
    
    if (id) {
        loadTeamData(id);
    }
    
    modal.classList.add('active');
}

async function loadTeamData(id) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/team/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.member) {
            const m = data.member;
            document.getElementById('teamName').value = m.name || '';
            document.getElementById('teamRole').value = m.role || '';
            document.getElementById('teamBio').value = m.bio || '';
            document.getElementById('teamImage').value = m.image || '';
            document.getElementById('teamLinkedIn').value = m.linkedin || '';
        }
    } catch (error) {
        console.error('Error loading team member:', error);
    }
}

window.editTeam = function(id) {
    openTeamModal(id);
};

window.deleteTeam = async function(id) {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/team/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            loadTeam();
            loadDashboard();
        } else {
            alert(data.message || 'Error deleting team member');
        }
    } catch (error) {
        alert('Error deleting team member');
    }
};

document.getElementById('teamForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('adminToken');
    const id = document.getElementById('teamId').value;
    const formData = {
        name: document.getElementById('teamName').value,
        role: document.getElementById('teamRole').value,
        bio: document.getElementById('teamBio').value,
        image: document.getElementById('teamImage').value,
        linkedin: document.getElementById('teamLinkedIn').value
    };
    
    try {
        const url = id ? `${API_BASE}/team/${id}` : `${API_BASE}/team`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        if (data.success) {
            closeModal('teamModal');
            loadTeam();
            loadDashboard();
        } else {
            alert(data.message || 'Error saving team member');
        }
    } catch (error) {
        alert('Error saving team member');
    }
});

// Testimonials
document.getElementById('addTestimonialBtn')?.addEventListener('click', () => {
    openTestimonialModal();
});

async function loadTestimonials() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/testimonials`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        const listEl = document.getElementById('testimonialsList');
        if (data.success && data.testimonials) {
            if (data.testimonials.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><h3>No testimonials yet</h3><p>Add your first testimonial to get started</p></div>';
            } else {
                listEl.innerHTML = data.testimonials.map(testimonial => `
                    <div class="item-card">
                        <div class="item-content">
                            <div class="item-title">${escapeHtml(testimonial.name)} - ${escapeHtml(testimonial.role)}</div>
                            <div class="item-description">${escapeHtml(testimonial.text)}</div>
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-secondary btn-sm" onclick="editTestimonial('${testimonial.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteTestimonial('${testimonial.id}')">Delete</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading testimonials:', error);
    }
}

function openTestimonialModal(id = null) {
    editingId = id;
    const modal = document.getElementById('testimonialModal');
    const form = document.getElementById('testimonialForm');
    const titleEl = document.getElementById('testimonialModalTitle');
    
    titleEl.textContent = id ? 'Edit Testimonial' : 'Add Testimonial';
    form.reset();
    document.getElementById('testimonialId').value = id || '';
    
    if (id) {
        loadTestimonialData(id);
    }
    
    modal.classList.add('active');
}

async function loadTestimonialData(id) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/testimonials/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.testimonial) {
            const t = data.testimonial;
            document.getElementById('testimonialName').value = t.name || '';
            document.getElementById('testimonialRole').value = t.role || '';
            document.getElementById('testimonialText').value = t.text || '';
            document.getElementById('testimonialImage').value = t.image || '';
        }
    } catch (error) {
        console.error('Error loading testimonial:', error);
    }
}

window.editTestimonial = function(id) {
    openTestimonialModal(id);
};

window.deleteTestimonial = async function(id) {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/testimonials/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            loadTestimonials();
            loadDashboard();
        } else {
            alert(data.message || 'Error deleting testimonial');
        }
    } catch (error) {
        alert('Error deleting testimonial');
    }
};

document.getElementById('testimonialForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('adminToken');
    const id = document.getElementById('testimonialId').value;
    const formData = {
        name: document.getElementById('testimonialName').value,
        role: document.getElementById('testimonialRole').value,
        text: document.getElementById('testimonialText').value,
        image: document.getElementById('testimonialImage').value
    };
    
    try {
        const url = id ? `${API_BASE}/testimonials/${id}` : `${API_BASE}/testimonials`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        if (data.success) {
            closeModal('testimonialModal');
            loadTestimonials();
            loadDashboard();
        } else {
            alert(data.message || 'Error saving testimonial');
        }
    } catch (error) {
        alert('Error saving testimonial');
    }
});

// Blog Posts
document.getElementById('addBlogBtn')?.addEventListener('click', () => {
    openBlogModal();
});

async function loadBlog() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/blog`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        const listEl = document.getElementById('blogList');
        if (data.success && data.posts) {
            if (data.posts.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><h3>No blog posts yet</h3><p>Add your first blog post to get started</p></div>';
            } else {
                listEl.innerHTML = data.posts.map(post => `
                    <div class="item-card">
                        <div class="item-content">
                            <div class="item-title">${escapeHtml(post.title)}</div>
                            <div class="item-description">${escapeHtml(post.excerpt)}</div>
                            <div class="item-meta">
                                <span>${escapeHtml(post.category)}</span>
                                <span>${new Date(post.date).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-secondary btn-sm" onclick="editBlog('${post.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteBlog('${post.id}')">Delete</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading blog:', error);
    }
}

function openBlogModal(id = null) {
    editingId = id;
    const modal = document.getElementById('blogModal');
    const form = document.getElementById('blogForm');
    const titleEl = document.getElementById('blogModalTitle');
    
    titleEl.textContent = id ? 'Edit Blog Post' : 'Add Blog Post';
    form.reset();
    document.getElementById('blogId').value = id || '';
    
    if (id) {
        loadBlogData(id);
    }
    
    modal.classList.add('active');
}

async function loadBlogData(id) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/blog/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.post) {
            const p = data.post;
            document.getElementById('blogTitle').value = p.title || '';
            document.getElementById('blogExcerpt').value = p.excerpt || '';
            document.getElementById('blogCategory').value = p.category || '';
            document.getElementById('blogDate').value = p.date ? p.date.split('T')[0] : '';
            document.getElementById('blogImage').value = p.image || '';
            document.getElementById('blogLink').value = p.link || '';
        }
    } catch (error) {
        console.error('Error loading blog post:', error);
    }
}

window.editBlog = function(id) {
    openBlogModal(id);
};

window.deleteBlog = async function(id) {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/blog/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            loadBlog();
            loadDashboard();
        } else {
            alert(data.message || 'Error deleting blog post');
        }
    } catch (error) {
        alert('Error deleting blog post');
    }
};

document.getElementById('blogForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('adminToken');
    const id = document.getElementById('blogId').value;
    const formData = {
        title: document.getElementById('blogTitle').value,
        excerpt: document.getElementById('blogExcerpt').value,
        category: document.getElementById('blogCategory').value,
        date: document.getElementById('blogDate').value,
        image: document.getElementById('blogImage').value,
        link: document.getElementById('blogLink').value
    };
    
    try {
        const url = id ? `${API_BASE}/blog/${id}` : `${API_BASE}/blog`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        if (data.success) {
            closeModal('blogModal');
            loadBlog();
            loadDashboard();
        } else {
            alert(data.message || 'Error saving blog post');
        }
    } catch (error) {
        alert('Error saving blog post');
    }
});

// FAQ
document.getElementById('addFaqBtn')?.addEventListener('click', () => {
    openFaqModal();
});

async function loadFAQ() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/faq`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        const listEl = document.getElementById('faqList');
        if (data.success && data.faqs) {
            if (data.faqs.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❓</div><h3>No FAQs yet</h3><p>Add your first FAQ to get started</p></div>';
            } else {
                listEl.innerHTML = data.faqs.map(faq => `
                    <div class="item-card">
                        <div class="item-content">
                            <div class="item-title">${escapeHtml(faq.question)}</div>
                            <div class="item-description">${escapeHtml(faq.answer)}</div>
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-secondary btn-sm" onclick="editFaq('${faq.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteFaq('${faq.id}')">Delete</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading FAQs:', error);
    }
}

function openFaqModal(id = null) {
    editingId = id;
    const modal = document.getElementById('faqModal');
    const form = document.getElementById('faqForm');
    const titleEl = document.getElementById('faqModalTitle');
    
    titleEl.textContent = id ? 'Edit FAQ' : 'Add FAQ';
    form.reset();
    document.getElementById('faqId').value = id || '';
    
    if (id) {
        loadFaqData(id);
    }
    
    modal.classList.add('active');
}

async function loadFaqData(id) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/faq/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.faq) {
            const f = data.faq;
            document.getElementById('faqQuestion').value = f.question || '';
            document.getElementById('faqAnswer').value = f.answer || '';
        }
    } catch (error) {
        console.error('Error loading FAQ:', error);
    }
}

window.editFaq = function(id) {
    openFaqModal(id);
};

window.deleteFaq = async function(id) {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/faq/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            loadFAQ();
            loadDashboard();
        } else {
            alert(data.message || 'Error deleting FAQ');
        }
    } catch (error) {
        alert('Error deleting FAQ');
    }
};

document.getElementById('faqForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('adminToken');
    const id = document.getElementById('faqId').value;
    const formData = {
        question: document.getElementById('faqQuestion').value,
        answer: document.getElementById('faqAnswer').value
    };
    
    try {
        const url = id ? `${API_BASE}/faq/${id}` : `${API_BASE}/faq`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        if (data.success) {
            closeModal('faqModal');
            loadFAQ();
            loadDashboard();
        } else {
            alert(data.message || 'Error saving FAQ');
        }
    } catch (error) {
        alert('Error saving FAQ');
    }
});

// Services
document.getElementById('addServiceBtn')?.addEventListener('click', () => {
    openServiceModal();
});

async function loadServices() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/services`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        const listEl = document.getElementById('servicesList');
        if (data.success && data.services) {
            if (data.services.length === 0) {
                listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚙️</div><h3>No services yet</h3><p>Add your first service to get started</p></div>';
            } else {
                listEl.innerHTML = data.services.map(service => `
                    <div class="item-card">
                        <div class="item-content">
                            <div class="item-title">${service.icon || ''} ${escapeHtml(service.title)}</div>
                            <div class="item-description">${escapeHtml(service.description)}</div>
                        </div>
                        <div class="item-actions">
                            <button class="btn btn-secondary btn-sm" onclick="editService('${service.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteService('${service.id}')">Delete</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

function openServiceModal(id = null) {
    editingId = id;
    const modal = document.getElementById('serviceModal');
    const form = document.getElementById('serviceForm');
    const titleEl = document.getElementById('serviceModalTitle');
    
    titleEl.textContent = id ? 'Edit Service' : 'Add Service';
    form.reset();
    document.getElementById('serviceId').value = id || '';
    
    if (id) {
        loadServiceData(id);
    }
    
    modal.classList.add('active');
}

async function loadServiceData(id) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/services/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.service) {
            const s = data.service;
            document.getElementById('serviceTitle').value = s.title || '';
            document.getElementById('serviceDescription').value = s.description || '';
            document.getElementById('serviceIcon').value = s.icon || '';
        }
    } catch (error) {
        console.error('Error loading service:', error);
    }
}

window.editService = function(id) {
    openServiceModal(id);
};

window.deleteService = async function(id) {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/services/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            loadServices();
            loadDashboard();
        } else {
            alert(data.message || 'Error deleting service');
        }
    } catch (error) {
        alert('Error deleting service');
    }
};

document.getElementById('serviceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('adminToken');
    const id = document.getElementById('serviceId').value;
    const formData = {
        title: document.getElementById('serviceTitle').value,
        description: document.getElementById('serviceDescription').value,
        icon: document.getElementById('serviceIcon').value
    };
    
    try {
        const url = id ? `${API_BASE}/services/${id}` : `${API_BASE}/services`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        if (data.success) {
            closeModal('serviceModal');
            loadServices();
            loadDashboard();
        } else {
            alert(data.message || 'Error saving service');
        }
    } catch (error) {
        alert('Error saving service');
    }
});

// Change Password
document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('adminToken');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageEl = document.getElementById('passwordMessage');
    
    if (newPassword !== confirmPassword) {
        messageEl.className = 'message error';
        messageEl.textContent = 'New passwords do not match';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const data = await response.json();
        if (data.success) {
            messageEl.className = 'message success';
            messageEl.textContent = 'Password changed successfully';
            document.getElementById('changePasswordForm').reset();
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = data.message || 'Error changing password';
        }
    } catch (error) {
        messageEl.className = 'message error';
        messageEl.textContent = 'Error changing password';
    }
});

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    editingId = null;
}

document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
            modal.classList.remove('active');
            editingId = null;
        }
    });
});

// Close modal on outside click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            editingId = null;
        }
    });
});

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

