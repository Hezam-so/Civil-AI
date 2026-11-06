# Civil AI — Real password recovery email delivery

The recovery UI/API are implemented in `account-gate.js` and `api/password-recovery.js`.

## Choose ONE sender

### Option A — Gmail (small-scale testing, no custom domain purchase required)

1. Choose a dedicated Gmail address for sending Civil AI security mail.
2. Enable Google 2-Step Verification for that sender.
3. Open https://myaccount.google.com/apppasswords in the sender account and create an **App Password**, if available for that account. This is not your normal Gmail password.
4. In Vercel → **civilai2026** → Settings → Environment Variables, add these as **Sensitive** values for Production:
   - `CIVIL_AI_SMTP_USER`: dedicated Gmail sender address.
   - `CIVIL_AI_SMTP_APP_PASSWORD`: generated Google App Password.
5. Redeploy the production project so the runtime picks up the new environment variables.
6. Test an existing Civil AI account through «نسيت كلمة المرور؟» using a real mailbox you control, check inbox/spam, enter the 8-digit code, reset the password, log in with the new password, and ensure the old password no longer works.

**Do not** paste the App Password into GitHub, source code, screenshots or chats. Google may not offer App Passwords on some managed accounts. Gmail imposes sending restrictions; for large-scale transactional email, use option B.

### Option B — Resend (preferred for public users)

1. Register an account at https://resend.com/; verify a domain you **own** by adding the prescribed DNS records at its DNS provider.
2. Create an email sending API key.
3. Add these Vercel **Sensitive** production variables:
   - `RESEND_API_KEY`: the API key with permission to send email.
   - `CIVIL_AI_EMAIL_FROM`: a sender on the verified domain, e.g. `Civil AI <security@your-owned-domain.example>`.
4. Redeploy production, and run the same reset test.

**Note:** `*.vercel.app` is a Vercel-owned platform domain, not a domain Civil AI can use for its own sender identity.

## Expected endpoint behavior

- `GET /api/password-recovery?action=status` returns only a boolean whether SMTP or Resend environment settings are **present**; it cannot guarantee deliverability.
- The sender is never exposed in client-side JavaScript.
- If mail sending fails, the app reports an error instead of claiming the code was sent.
- Code: 8 digits, valid 10 minutes, 5 verification attempts; only HMAC digest is stored, not the code.
- Changing a password requires 8+ characters and invalidates prior signed sessions.
- Reset codes must **never** be supplied by support agents or logged.

## Security operations

- Avoid sending verification email to unverified user-controlled accounts outside the allowed recovery flow.
- Monitor Vercel function logs (never include code or secrets).
- Enable provider-side volume controls, DKIM/SPF/DMARC for custom domains, and distributed abuse/rate limits before broad public launch.
- Consider adding email verification at signup, account deletion, automated cleanup of old reset objects, and audited monitoring.
