# Painel Moda Infantil

Publique a raiz deste repositório como site estático. O painel abre em `/`.

1. Aplique a migração do [repositório da vitrine](https://github.com/socialswapoficial-creator/moda-infatil/tree/main/supabase/migrations) uma única vez no projeto Supabase ativo.
2. Preencha `supabase-config.js` nos dois repositórios com a mesma URL e chave publicável do projeto. Atualize `storefrontUrl` aqui se mudar o domínio da loja.
3. Crie a conta da equipe em Supabase Authentication e autorize seu UUID em `public.moda_catalog_admins`.

```sql
insert into public.moda_catalog_admins (user_id)
values ('00000000-0000-0000-0000-000000000000');
```

As fotos e banners enviados pelo painel ficam no Supabase Storage. As artes originais são lidas de uma revisão fixa da vitrine. As permissões do Supabase exigem uma conta administradora para alterações e uploads.
