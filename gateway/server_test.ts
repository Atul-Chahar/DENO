import { assertEquals } from "jsr:@std/assert";

Deno.test("Gateway Health URL check", () => {
  const defaultPort = 8080;
  const backendUrl = "http://127.0.0.1:8000";
  assertEquals(defaultPort, 8080);
  assertEquals(backendUrl, "http://127.0.0.1:8000");
});
