---
name: security-auditor
description: Realiza auditorias completas de segurança e verificação de boas práticas no Balmiza App
---

# Skill de Auditoria de Segurança — Balmiza App

Use esta skill sempre que o usuário solicitar uma auditoria de segurança, revisão de vulnerabilidades ou validação de novas implementações de segurança no projeto Balmiza.

## Escopo da Auditoria

Ao rodar esta auditoria, você deve ler e verificar sistematicamente:
1. **Configurações e Chaves**:
   - Verificar se há segredos no código em `src/config/firebase.ts`.
   - Garantir que o `.env` está devidamente listado no `.gitignore`.
2. **Fluxo de Acesso e Guards**:
   - Verificar regras em `src/navigation/AppNavigator.tsx` para garantir que rotas admin estão bloqueadas.
   - Verificar se o logout limpa a sessão com `firebase.auth().signOut()`.
3. **Regras de Segurança do Firestore**:
   - Validar se o arquivo `firestore.rules` está na raiz e se utiliza a sintaxe CEL correta (ex: `.lower()` em vez de `.toLowerCase()`).
   - Garantir que as regras cobrem as coleções `usuarios`, `viagens`, `trips`, `veiculos`, `funcionarios`, `locais_favoritos`, `avarias`, `reembolsos` e `shifts` com permissões de privilégio mínimo.
4. **Armazenamento de Senhas/PIN**:
   - Verificar se o PIN em `src/components/PinInput.tsx` é armazenado como hash e possui proteção contra força bruta (lockout).
5. **Privacidade de Dados (LGPD)**:
   - Garantir que dados sensíveis de funcionários (como endereços) não estão sendo vazados para APIs externas (Gemini/IA) sem máscara.
6. **Uploads Seguros**:
   - Verificar se os uploads de fotos em `TripClosingModal.tsx` e `DamageReportScreen.tsx` usam o proxy seguro `/api/upload` no servidor, mantendo as chaves privadas.

## Diretrizes de Resposta

1. Categorize as descobertas por severidade:
   - 🔴 **CRÍTICA**: Riscos imediatos de invasão, escalação de privilégios ou chaves expostas publicamente.
   - 🟠 **ALTA**: Violações de regras de negócio ou de privacidade (LGPD).
   - 🟡 **MÉDIA**: Defesas fracas (como falha em invalidar sessões locais no servidor ou brute force).
   - 🟢 **BAIXA**: Melhorias gerais e boas práticas.
2. Apresente um resumo executivo com a contagem de vulnerabilidades.
3. Forneça o código exato de correção para cada arquivo vulnerável.
