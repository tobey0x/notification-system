import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { app, prisma } from "../src/index";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.ACCESS_SECRET = process.env.ACCESS_SECRET || "test-access-secret";
  process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || "test-ref-secret";

  // Mock prisma user methods used by the controllers
  // @ts-ignoreq
  prisma.user = prisma.user || ({} as any);
  prisma.user.findUnique = vi.fn();
  prisma.user.create = vi.fn();
  prisma.user.update = vi.fn();

  // @ts-ignore
  prisma.userPreference = prisma.userPreference || ({} as any);
  // @ts-ignore
  prisma.userPreference.findUnique = vi.fn();
  // @ts-ignore
  prisma.userPreference.create = vi.fn();
  // @ts-ignore
  prisma.userPreference.update = vi.fn();

  // @ts-ignore
  prisma.pushToken = prisma.pushToken || ({} as any);
  // @ts-ignore
  prisma.pushToken.create = vi.fn();
  // @ts-ignore
  prisma.pushToken.findUnique = vi.fn();
  // @ts-ignore
  prisma.pushToken.update = vi.fn();
  // @ts-ignore
  prisma.pushToken.delete = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("API - health and auth", () => {
  it("GET /api/v1/health returns ok when DB not configured", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe("ok");
    expect(json.db).toBe("not configured");
  });

  it("POST /api/v1/auth/register creates a user and returns tokens", async () => {
    // @ts-ignore
    prisma.user.findUnique.mockResolvedValue(null);
    // @ts-ignore
    prisma.user.create.mockResolvedValue({
      id: "u1",
      name: "John Doe",
      email: "john.doe@example.com",
      password: "hashed",
      role: "user",
    });
    // @ts-ignore
    prisma.user.update.mockResolvedValue({
      id: "u1",
      refreshToken: "refresh-token",
    });

    const payload = {
      name: "John Doe",
      email: "john.doe@example.com",
      password: "password123",
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("access_token");
    expect(body.data).toHaveProperty("refresh_token");
  });

  it("POST /api/v1/auth/login returns tokens for valid credentials", async () => {
    const mockUser = {
      id: "u1",
      name: "John Doe",
      email: "john.doe@example.com",
      password: "hashed-password",
      role: "user",
    };
    // @ts-ignore
    prisma.user.findUnique.mockResolvedValue(mockUser);
    vi.spyOn(bcrypt, "compare").mockResolvedValue(true as any);
    // @ts-ignore
    prisma.user.update.mockResolvedValue({
      ...mockUser,
      refreshToken: "new-refresh",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: mockUser.email, password: "password123" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("access_token");
    expect(body.data).toHaveProperty("refresh_token");
  });
});

describe("API - users", () => {
  it("GET /api/v1/users/profile (auth) returns profile for authenticated user", async () => {
    const mockUser = {
      id: "u1",
      name: "Jane",
      email: "jane@example.com",
      role: "user",
      created_at: new Date().toISOString(),
      preference: {
        id: "p1",
        userId: "u1",
        email_enabled: true,
        push_enabled: true,
        language: "en",
        timezone: null,
      },
      pushTokens: [
        {
          id: "t1",
          userId: "u1",
          token: "tok",
          platform: "android",
          device_name: null,
          created_at: new Date().toISOString(),
        },
      ],
    };
    // @ts-ignore
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const token = jwt.sign(
      { userId: "u1", role: "user" },
      process.env.ACCESS_SECRET!
    );
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users/profile",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("u1");
  });

  it("GET /api/v1/users/profile/:id returns public profile", async () => {
    const mockUser = {
      id: "u2",
      name: "Bob",
      email: "bob@example.com",
      role: "user",
      created_at: new Date().toISOString(),
      preference: null,
      pushTokens: [],
    };
    // @ts-ignore
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users/profile/u2",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("u2");
  });

  it("GET /api/v1/users/preference/:id returns preference (auth)", async () => {
    const pref = {
      id: "p2",
      userId: "u2",
      email_enabled: false,
      push_enabled: true,
      language: "es",
      timezone: "Europe/Madrid",
    };
    // @ts-ignore
    prisma.userPreference.findUnique.mockResolvedValue(pref);
    const token = jwt.sign(
      { userId: "u2", role: "user" },
      process.env.ACCESS_SECRET!
    );
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users/preference/u2",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe("u2");
  });

  it("POST /api/v1/users/preference/:id creates preference (auth)", async () => {
    // @ts-ignore
    prisma.user.findUnique.mockResolvedValue({ id: "u3" });
    // @ts-ignore
    prisma.userPreference.findUnique.mockResolvedValue(null);
    // @ts-ignore
    prisma.userPreference.create.mockResolvedValue({
      id: "p3",
      userId: "u3",
      email_enabled: true,
      push_enabled: true,
      language: "en",
      timezone: null,
    });
    const token = jwt.sign(
      { userId: "u3", role: "user" },
      process.env.ACCESS_SECRET!
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users/preference/u3",
      headers: { authorization: `Bearer ${token}` },
      payload: { email_enabled: true },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe("u3");
  });

  it("PATCH /api/v1/users/preference/:id updates preference (auth)", async () => {
    // @ts-ignore
    prisma.userPreference.findUnique.mockResolvedValue({
      id: "p4",
      userId: "u4",
      email_enabled: true,
      push_enabled: false,
      language: "en",
      timezone: null,
    });
    // @ts-ignore
    prisma.userPreference.update.mockResolvedValue({
      id: "p4",
      userId: "u4",
      email_enabled: true,
      push_enabled: true,
      language: "en",
      timezone: null,
    });
    const token = jwt.sign(
      { userId: "u4", role: "user" },
      process.env.ACCESS_SECRET!
    );
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/preference/u4",
      headers: { authorization: `Bearer ${token}` },
      payload: { push_enabled: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.push_enabled).toBe(true);
  });

  it("POST /api/v1/users/push-token adds token (auth)", async () => {
    // @ts-ignore
    prisma.pushToken.create.mockResolvedValue({
      id: "t2",
      userId: "u5",
      token: "tkn",
      platform: "ios",
      device_name: "iPhone",
    });
    const token = jwt.sign(
      { userId: "u5", role: "user" },
      process.env.ACCESS_SECRET!
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users/push-token",
      headers: { authorization: `Bearer ${token}` },
      payload: { token: "tkn", platform: "ios" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe("u5");
  });

  it("PATCH /api/v1/users/push-token/:id updates token (auth)", async () => {
    // existing token owned by u6
    // @ts-ignore
    prisma.pushToken.findUnique.mockResolvedValue({
      id: "t3",
      userId: "u6",
      token: "old",
      platform: "android",
      device_name: "Old",
    });
    // @ts-ignore
    prisma.pushToken.update.mockResolvedValue({
      id: "t3",
      userId: "u6",
      token: "old",
      platform: "android",
      device_name: "New",
    });
    const token = jwt.sign(
      { userId: "u6", role: "user" },
      process.env.ACCESS_SECRET!
    );
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/push-token/t3",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_name: "New" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.device_name).toBe("New");
  });

  it("DELETE /api/v1/users/push-token/:id deletes token (auth)", async () => {
    // existing token owned by u7
    // @ts-ignore
    prisma.pushToken.findUnique.mockResolvedValue({
      id: "t4",
      userId: "u7",
      token: "old",
    });
    // @ts-ignore
    prisma.pushToken.delete.mockResolvedValue({});
    const token = jwt.sign(
      { userId: "u7", role: "user" },
      process.env.ACCESS_SECRET!
    );
    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/push-token/t4",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
  });
});
