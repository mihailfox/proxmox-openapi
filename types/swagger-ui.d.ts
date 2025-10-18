declare module "swagger-ui-dist/swagger-ui-es-bundle" {
  interface SwaggerUIInstance {
    destroy?: () => void;
  }

  interface SwaggerUIPreset {
    apis: unknown;
  }

  interface SwaggerUIBundle {
    (options: Record<string, unknown>): SwaggerUIInstance;
    presets: SwaggerUIPreset;
  }

  const SwaggerUIBundle: SwaggerUIBundle;
  export default SwaggerUIBundle;
}
