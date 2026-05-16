import { describe, expect, test } from "vitest";
import { loginSchema, registerSchema, changePasswordSchema } from "./auth";

describe("loginSchema", () => {
  test("válido com username e password preenchidos", () => {
    const result = loginSchema.safeParse({ username: "ana", password: "secret" });
    expect(result.success).toBe(true);
  });

  test("rejeita username vazio", () => {
    const result = loginSchema.safeParse({ username: "", password: "secret" });
    expect(result.success).toBe(false);
  });

  test("rejeita password vazia", () => {
    const result = loginSchema.safeParse({ username: "ana", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    username: "ana",
    email: "ana@example.com",
    password: "Abc12345",
    confirm_password: "Abc12345",
    terms_accepted: true as const,
    website: "" as const,
  };

  test("válido com todos os campos corretos", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  test("rejeita email inválido", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  test("rejeita password com menos de 8 chars (BVA: 7 chars inválido)", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Abc1234", confirm_password: "Abc1234" });
    expect(result.success).toBe(false);
  });

  test("aceita password com exatamente 8 chars (BVA: 8 chars válido)", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Abc12345", confirm_password: "Abc12345" });
    expect(result.success).toBe(true);
  });

  test("rejeita quando confirm_password difere de password", () => {
    const result = registerSchema.safeParse({ ...valid, confirm_password: "Diferente1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("confirm_password");
    }
  });

  test("rejeita quando terms_accepted não é true", () => {
    const result = registerSchema.safeParse({ ...valid, terms_accepted: undefined });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  const valid = {
    current_password: "OldPass1!",
    new_password: "NewPass1!",
    confirm_password: "NewPass1!",
  };

  test("válido com todos os campos corretos", () => {
    const result = changePasswordSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  test("rejeita current_password vazia", () => {
    const result = changePasswordSchema.safeParse({ ...valid, current_password: "" });
    expect(result.success).toBe(false);
  });

  test("rejeita new_password com menos de 8 chars", () => {
    const result = changePasswordSchema.safeParse({ ...valid, new_password: "short", confirm_password: "short" });
    expect(result.success).toBe(false);
  });

  test("rejeita quando confirm_password difere de new_password", () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirm_password: "WrongPass!" });
    expect(result.success).toBe(false);
  });
});
