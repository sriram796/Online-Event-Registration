const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

function ensureDB() {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(
            DB_FILE,
            JSON.stringify({
                users: [],
                events: [],
                registrations: []
            }, null, 2)
        );
    }
}

function readDB() {
    ensureDB();
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDB(db) {
    ensureDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function safeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    };
}

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Please login first."
        });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required."
        });
    }
    next();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || "development-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    }
}));

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

// Student registration
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                message: "Invalid email."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters."
            });
        }

        const db = readDB();
        const normalizedEmail = email.trim().toLowerCase();

        if (db.users.some(u => u.email === normalizedEmail)) {
            return res.status(409).json({
                message: "Email already registered."
            });
        }

        const user = {
            id: crypto.randomUUID(),
            name: name.trim(),
            email: normalizedEmail,
            passwordHash: await bcrypt.hash(password, 10),
            role: "student"
        };

        db.users.push(user);
        writeDB(db);

        req.session.user = safeUser(user);

        res.status(201).json({
            message: "Registration successful.",
            user: safeUser(user)
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error."
        });
    }
});

// Student login
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password required."
        });
    }

    const db = readDB();

    const user = db.users.find(
        u => u.email === email.trim().toLowerCase()
    );

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({
            message: "Invalid email or password."
        });
    }

    req.session.user = safeUser(user);

    res.json({
        message: "Login successful.",
        user: safeUser(user)
    });
});

// Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logged out successfully." });
    });
});

// Current user
app.get("/api/me", (req, res) => {
    res.json({
        user: req.session.user || null
    });
});

// View events
app.get("/api/events", (req, res) => {
    const db = readDB();

    const events = db.events.map(event => {
        const count = db.registrations.filter(
            r => r.eventId === event.id
        ).length;

        return {
            ...event,
            registeredCount: count,
            seatsLeft: Math.max(0, event.capacity - count)
        };
    });

    res.json(events);
});

// Register for event
app.post("/api/events/:id/register", requireAuth, (req, res) => {
    const db = readDB();

    const event = db.events.find(
        e => e.id === req.params.id
    );

    if (!event) {
        return res.status(404).json({
            message: "Event not found."
        });
    }

    const duplicate = db.registrations.some(
        r => r.eventId === event.id &&
             r.userId === req.session.user.id
    );

    if (duplicate) {
        return res.status(409).json({
            message: "Already registered."
        });
    }

    const count = db.registrations.filter(
        r => r.eventId === event.id
    ).length;

    if (count >= event.capacity) {
        return res.status(409).json({
            message: "Event is full."
        });
    }

    const registration = {
        id: crypto.randomUUID(),
        eventId: event.id,
        userId: req.session.user.id,
        registeredAt: new Date().toISOString()
    };

    db.registrations.push(registration);
    writeDB(db);

    res.status(201).json({
        message: "Registration confirmed.",
        registration
    });
});

// Student dashboard
app.get("/api/my-registrations", requireAuth, (req, res) => {
    const db = readDB();

    const registrations = db.registrations
        .filter(r => r.userId === req.session.user.id)
        .map(r => ({
            ...r,
            event: db.events.find(e => e.id === r.eventId) || null
        }));

    res.json(registrations);
});

// Admin creates event
app.post("/api/admin/events", requireAdmin, (req, res) => {
    const {
        title, description, date, time,
        venue, capacity, category
    } = req.body;

    if (!title || !date || !venue ||
        !Number.isInteger(Number(capacity)) ||
        Number(capacity) < 1) {
        return res.status(400).json({
            message: "Invalid event details."
        });
    }

    const db = readDB();

    const event = {
        id: crypto.randomUUID(),
        title,
        description: description || "",
        date,
        time: time || "",
        venue,
        capacity: Number(capacity),
        category: category || "General"
    };

    db.events.push(event);
    writeDB(db);

    res.status(201).json({
        message: "Event created.",
        event
    });
});

// Admin updates event
app.put("/api/admin/events/:id", requireAdmin, (req, res) => {
    const db = readDB();

    const event = db.events.find(
        e => e.id === req.params.id
    );

    if (!event) {
        return res.status(404).json({
            message: "Event not found."
        });
    }

    Object.assign(event, req.body);

    if (req.body.capacity !== undefined) {
        event.capacity = Number(req.body.capacity);
    }

    writeDB(db);

    res.json({
        message: "Event updated.",
        event
    });
});

// Admin deletes event
app.delete("/api/admin/events/:id", requireAdmin, (req, res) => {
    const db = readDB();

    if (!db.events.some(e => e.id === req.params.id)) {
        return res.status(404).json({
            message: "Event not found."
        });
    }

    db.events = db.events.filter(
        e => e.id !== req.params.id
    );

    db.registrations = db.registrations.filter(
        r => r.eventId !== req.params.id
    );

    writeDB(db);

    res.json({
        message: "Event deleted."
    });
});

// Admin views participants
app.get("/api/admin/participants", requireAdmin, (req, res) => {
    const db = readDB();

    const participants = db.registrations.map(r => {
        const user = db.users.find(u => u.id === r.userId);
        const event = db.events.find(e => e.id === r.eventId);

        return {
            registrationId: r.id,
            registeredAt: r.registeredAt,
            student: user ? safeUser(user) : null,
            event: event || null
        };
    });

    res.json(participants);
});

if (require.main === module) {
    ensureDB();

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = {
    app,
    readDB,
    writeDB,
    ensureDB
};