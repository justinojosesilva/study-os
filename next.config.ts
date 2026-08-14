import type { NextConfig } from "next";

/**
 * O sistema tem QUATRO endereços e um só deve responder.
 *
 * `latisskills.com` e `latisskills.com.br`, cada um com e sem `www`, foram
 * todos ligados ao projeto — o `.com` como proteção de marca, não como
 * endereço. Servindo os quatro diretamente, o mesmo conteúdo existe em quatro
 * lugares: buscador trata isso como duplicado e divide a autoridade entre eles.
 *
 * O redirecionamento mora AQUI, e não no painel da Vercel, por duas razões:
 * fica versionado junto com o código, e sobrevive a trocar de hospedagem — o
 * que é relevante, já que uma VPS chegou a ser considerada.
 */

const CANONICO = "latisskills.com.br";

/**
 * Os outros três. O canônico NÃO entra nesta lista: se entrasse, ele
 * redirecionaria para si mesmo e o navegador entraria em laço.
 */
const ALIASES = ["www.latisskills.com.br", "latisskills.com", "www.latisskills.com"];

const nextConfig: NextConfig = {
  async redirects() {
    return ALIASES.map((host) => ({
      // `:path*` com asterisco casa zero ou mais segmentos, então a raiz entra
      // junto — sem isso, `latisskills.com` sozinho não redirecionaria.
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `https://${CANONICO}/:path*`,
      // 308. É o que consolida a autoridade para o buscador, que é o motivo de
      // isto existir. Em compensação o navegador CACHEIA de forma agressiva:
      // se um dia o canônico mudar, quem já visitou continuará sendo mandado
      // para cá até limpar o cache. Trocar de domínio de novo exige saber
      // disso.
      permanent: true,
    }));
  },
};

export default nextConfig;
