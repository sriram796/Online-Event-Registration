const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcryptjs");

let tempDir;
let app;
let readDB;
let writeDB;

beforeEach(() => {
    tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "events-test-")
    );

    process.env.DATA_DIR = tempDir;

    jest.resetModules();

    ({ app, readDB, writeDB } = require("../server"));

    writeDB({
        users: [],
        events: [
            {
                id: "event-1",
                title: "Test Event",
                description: "Testing",
                date: "2027-01-01",
                time: "10:00",
                venue: "Hall",
                capacity: 1,
                category: "Test"
            }
        ],
        registrations: []
    });
});

afterEach(() => {
    fs.rmSync(tempDir, {
        recursive: true,
        force: true
    });

    delete process.env.DATA_DIR;
});

describe("Event Registration API", () => {

    test("Health endpoint works", async () => {
        const response = await request(app).get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ok");
    });

    test("Student registration works", async () => {
        const response = await request(app)
            .post("/api/register")
            .send({
                name: "Test Student",
                email: "student@example.com",
                password: "password123"
            });

        expect(response.status).toBe(201);
    });

    test("Duplicate email is rejected", async () => {
        const agent = request.agent(app);

        const payload = {
            name: "Student",
            email: "student@example.com",
            password: "password123"
        };

        await agent.post("/api/register").send(payload);

        const response = await request(app)
            .post("/api/register")
            .send(payload);

        expect(response.status).toBe(409);
    });

    test("Invalid login is rejected", async () => {
        const response = await request(app)
            .post("/api/login")
            .send({
                email: "unknown@example.com",
                password: "wrongpass"
            });

        expect(response.status).toBe(401);
    });

    test("Events can be listed", async () => {
        const response = await request(app).get("/api/events");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
    });

    test("Student can register for event once", async () => {
        const agent = request.agent(app);

        await agent.post("/api/register").send({
            name: "Student",
            email: "s@example.com",
            password: "password123"
        });

        const first = await agent
            .post("/api/events/event-1/register")
            .send({});

        const second = await agent
            .post("/api/events/event-1/register")
            .send({});

        expect(first.status).toBe(201);
        expect(second.status).toBe(409);
    });

    test("Event capacity is enforced", async () => {
        const firstAgent = request.agent(app);

        await firstAgent.post("/api/register").send({
            name: "One",
            email: "one@example.com",
            password: "password123"
        });

        await firstAgent
            .post("/api/events/event-1/register")
            .send({});

        const secondAgent = request.agent(app);

        await secondAgent.post("/api/register").send({
            name: "Two",
            email: "two@example.com",
            password: "password123"
        });

        const response = await secondAgent
            .post("/api/events/event-1/register")
            .send({});

        expect(response.status).toBe(409);
    });

    test("Admin can create event", async () => {
        const admin = {
            id: "admin-1",
            name: "Admin",
            email: "admin@example.com",
            passwordHash: await bcrypt.hash("password123", 10),
            role: "admin"
        };

        const db = readDB();
        db.users.push(admin);
        writeDB(db);

        const agent = request.agent(app);

        await agent.post("/api/login").send({
            email: admin.email,
            password: "password123"
        });

        const response = await agent
            .post("/api/admin/events")
            .send({
                title: "New Event",
                date: "2027-02-01",
                venue: "Auditorium",
                capacity: 20
            });

        expect(response.status).toBe(201);
    });

});