async function api(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        credentials: "same-origin",
        ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

function showMessage(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("error", isError);
}

function eventCard(event, showRegister = true) {
    const card = document.createElement("article");
    card.className = "event-card";

    const tag = document.createElement("span");
    tag.className = "event-tag";
    tag.textContent = event.category || "Event";

    const title = document.createElement("h3");
    title.textContent = event.title;

    const desc = document.createElement("p");
    desc.textContent = event.description || "Join this campus event.";

    const meta = document.createElement("div");
    meta.className = "event-meta";

    const date = document.createElement("span");
    date.textContent = `Date: ${event.date} ${event.time || ""}`;

    const venue = document.createElement("span");
    venue.textContent = `Venue: ${event.venue}`;

    const seats = document.createElement("span");
    seats.textContent = `Seats left: ${event.seatsLeft ?? event.capacity}`;

    meta.append(date, venue, seats);
    card.append(tag, title, desc, meta);

    if (showRegister) {
        const button = document.createElement("button");
        button.className = "btn";
        button.textContent = "Register for Event";

        button.addEventListener("click", async () => {
            try {
                const result = await api(
                    `/api/events/${encodeURIComponent(event.id)}/register`,
                    {
                        method: "POST",
                        body: "{}"
                    }
                );

                alert(result.message);
                location.reload();

            } catch (error) {
                alert(error.message);

                if (error.message.includes("login")) {
                    location.href = "/login.html";
                }
            }
        });

        card.append(button);
    }

    return card;
}

async function loadEvents(targetId, limit) {
    const target = document.getElementById(targetId);

    if (!target) return;

    try {
        const events = await api("/api/events");

        target.replaceChildren();

        const selected = limit ? events.slice(0, limit) : events;

        selected.forEach(event => {
            target.append(eventCard(event));
        });

        if (!events.length) {
            target.textContent = "No events available.";
        }

    } catch (error) {
        target.textContent = error.message;
    }
}

async function setupAuth() {
    const register = document.getElementById("register-form");
    const login = document.getElementById("login-form");

    const forms = [
        [register, "/api/register"],
        [login, "/api/login"]
    ];

    for (const [form, endpoint] of forms) {
        if (!form) continue;

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const message = form.querySelector(".message");

            const body = Object.fromEntries(
                new FormData(form).entries()
            );

            try {
                const result = await api(endpoint, {
                    method: "POST",
                    body: JSON.stringify(body)
                });

                showMessage(message, result.message);

                location.href = "/dashboard.html";

            } catch (error) {
                showMessage(message, error.message, true);
            }
        });
    }
}

async function setupDashboard() {
    const target = document.getElementById("my-registrations");

    if (!target) return;

    try {
        const me = await api("/api/me");

        if (!me.user) {
            location.href = "/login.html";
            return;
        }

        document.getElementById("welcome").textContent =
            `Welcome, ${me.user.name}`;

        const registrations = await api("/api/my-registrations");

        target.replaceChildren();

        registrations.forEach(row => {
            if (row.event) {
                target.append(eventCard(row.event, false));
            }
        });

        if (!registrations.length) {
            target.textContent = "No registrations yet.";
        }

    } catch (error) {
        showMessage(
            document.getElementById("page-message"),
            error.message,
            true
        );
    }
}

async function setupAdmin() {
    const form = document.getElementById("event-form");

    if (!form) return;

    try {
        const me = await api("/api/me");

        if (!me.user || me.user.role !== "admin") {
            showMessage(
                document.getElementById("page-message"),
                "Admin access required.",
                true
            );

            form.querySelector("button").disabled = true;
            return;
        }

        const participants = await api("/api/admin/participants");

        const list = document.getElementById("participants");
        list.replaceChildren();

        participants.forEach(row => {
            const item = document.createElement("div");
            item.className = "participant";

            item.textContent =
                `${row.student?.name || "Unknown"} - ${row.event?.title || "Event removed"}`;

            list.append(item);
        });

        if (!participants.length) {
            list.textContent = "No participants yet.";
        }

    } catch (error) {
        showMessage(
            document.getElementById("page-message"),
            error.message,
            true
        );
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const body = Object.fromEntries(
            new FormData(form).entries()
        );

        body.capacity = Number(body.capacity);

        try {
            await api("/api/admin/events", {
                method: "POST",
                body: JSON.stringify(body)
            });

            showMessage(
                form.querySelector(".message"),
                "Event created successfully."
            );

            form.reset();

        } catch (error) {
            showMessage(
                form.querySelector(".message"),
                error.message,
                true
            );
        }
    });
}

function setupLogout() {
    const button = document.getElementById("logout-button");

    if (button) {
        button.addEventListener("click", async () => {
            await api("/api/logout", {
                method: "POST",
                body: "{}"
            });

            location.href = "/";
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadEvents("featured-events", 3);
    loadEvents("event-list");

    setupAuth();
    setupDashboard();
    setupAdmin();
    setupLogout();
});