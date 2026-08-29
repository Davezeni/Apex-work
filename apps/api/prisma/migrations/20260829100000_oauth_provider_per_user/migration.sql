-- Prevent the same Apex-Work account from linking two identities from one provider.
CREATE UNIQUE INDEX "OAuthAccount_userId_provider_key" ON "OAuthAccount"("userId", "provider");
