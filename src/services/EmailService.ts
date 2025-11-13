/**
 * Parallel-safe Email Client for testing
 *
 * Supports both Mailpit (localhost:8025) and Mailcatcher (port 1080)
 * Works with full parallel test execution by filtering emails uniquely per test
 */

export interface Email {
    id: string;
    from: { address: string; name: string };
    to: Array<{ address: string; name: string }>;
    subject: string;
    text: string;
    html: string;
    created_at?: string;
}

interface MailpitMessage {
    ID: string;
    From: { Address: string; Name: string };
    To: Array<{ Address: string; Name: string }>;
    Subject: string;
    Text: string;
    HTML: string;
    Created: string;
}

interface MailcatcherMessage {
    id: number;
    sender: string;
    recipients: string[];
    subject: string;
    source: string;
}

const normalizeEmailAddress = (address: string): string => {
    if (!address) {
        return '';
    }

    const match = address.match(/<([^>]+)>/);
    if (match?.[1]) {
        return match[1].trim();
    }

    return address.trim();
};

export class EmailService {
    private readonly baseUrl: string;
    private readonly isMailpit: boolean;

    constructor(baseUrl?: string) {
        // Auto-detect email service or use provided URL
        this.baseUrl = baseUrl || process.env.EMAIL_SERVICE_URL || 'http://localhost:8025';
        this.isMailpit = this.baseUrl.includes('8025');
    }

    async getEmailsByRecipient(email: string): Promise<Email[]> {
        const allEmails = await this.getAllEmails();
        const emailLower = email.toLowerCase();

        return allEmails.filter(msg =>
            msg.to.some(recipient => {
                const recipientAddress = recipient.address.toLowerCase();
                return recipientAddress === emailLower || recipientAddress.includes(emailLower);
            })
        );
    }

    async getEmailsByContentMatch(searchText: string): Promise<Email[]> {
        const allEmails = await this.getAllEmails();
        const searchLower = searchText.toLowerCase();

        return allEmails.filter(msg => {
            const subjectMatch = msg.subject.toLowerCase().includes(searchLower);
            const textMatch = msg.text.toLowerCase().includes(searchLower);
            const htmlMatch = msg.html.toLowerCase().includes(searchLower);
            return subjectMatch || textMatch || htmlMatch;
        });
    }

    async waitForEmail(
        recipient?: string,
        contentMatch?: string,
        timeoutMs: number = 3000
    ): Promise<Email> {
        const effectiveTimeout = Math.max(timeoutMs, 2000);
        const startTime = Date.now();
        const pollInterval = 250;

        while (Date.now() - startTime < effectiveTimeout) {
            let emails: Email[];

            if (recipient) {
                emails = await this.getEmailsByRecipient(recipient);
                if (process.env.DEBUG_EMAIL_CLIENT === 'true') {
                    console.log(`[EmailClient] Found ${emails.length} email(s) for recipient ${recipient}`);
                }
            } else if (contentMatch) {
                emails = await this.getEmailsByContentMatch(contentMatch);
                if (process.env.DEBUG_EMAIL_CLIENT === 'true') {
                    console.log(`[EmailClient] Found ${emails.length} email(s) matching content "${contentMatch}"`);
                }
            } else {
                throw new Error('Must provide either recipient or contentMatch parameter');
            }

            if (emails.length > 0) {
                if (recipient && contentMatch) {
                    const contentLower = contentMatch.toLowerCase();
                    emails = emails.filter(email =>
                        email.subject.toLowerCase().includes(contentLower) ||
                        email.text.toLowerCase().includes(contentLower) ||
                        email.html.toLowerCase().includes(contentLower)
                    );
                }

                if (emails.length > 0) {
                    return emails[emails.length - 1];
                }
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(
            `Timeout waiting for email. Recipient: ${recipient || 'none'}, ` +
            `ContentMatch: ${contentMatch || 'none'}, Timeout: ${effectiveTimeout}ms`
        );
    }

    async waitForEmailWithSubjectTokens(options: {
        recipient?: string;
        contentMatch?: string;
        subjectTokens: string[];
        timeoutMs?: number;
    }): Promise<Email> {
        const {recipient, contentMatch, subjectTokens, timeoutMs = 4000} = options;

        if (!recipient && !contentMatch) {
            throw new Error('waitForEmailWithSubjectTokens requires at least a recipient or contentMatch');
        }

        if (!subjectTokens.length) {
            throw new Error('waitForEmailWithSubjectTokens requires subjectTokens');
        }

        const hasContentMatch = typeof contentMatch === 'string' && contentMatch.length > 0;
        const contentLower = hasContentMatch ? contentMatch!.toLowerCase() : '';
        const normalizedTokens = subjectTokens.map(token => token.toLowerCase());
        const startTime = Date.now();
        const pollInterval = 250;

        while (Date.now() - startTime < timeoutMs) {
            let candidates: Email[];

            if (recipient) {
                candidates = await this.getEmailsByRecipient(recipient);
            } else {
                candidates = await this.getEmailsByContentMatch(contentMatch!);
            }

            const filtered = candidates.filter(email => {
                const subjectLower = email.subject.toLowerCase();
                const combinedContent = `${email.subject} ${email.text} ${email.html}`.toLowerCase();

                const contentMatches = hasContentMatch ? combinedContent.includes(contentLower) : true;
                const tokensMatch = normalizedTokens.every(token => subjectLower.includes(token));

                return contentMatches && tokensMatch;
            });

            if (filtered.length > 0) {
                return filtered[filtered.length - 1];
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(
            `Timeout waiting for email with${hasContentMatch ? ` content "${contentMatch}" and` : ''} subject tokens ${subjectTokens.join(', ')}`
        );
    }

    async clearInbox(): Promise<void> {
        try {
            if (this.isMailpit) {
                await fetch(`${this.baseUrl}/api/v1/messages`, {method: 'DELETE'});
            } else {
                const response = await fetch(`${this.baseUrl}/messages`);
                const messages = await response.json();
                for (const msg of messages) {
                    await fetch(`${this.baseUrl}/messages/${msg.id}`, {method: 'DELETE'});
                }
            }
        } catch {
            // Ignore errors - inbox might already be empty or service unavailable
        }
    }

    private async getAllEmails(): Promise<Email[]> {
        return this.isMailpit ? this.getAllEmailsMailpit() : this.getAllEmailsMailcatcher();
    }

    private async getAllEmailsMailpit(): Promise<Email[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/messages`);
            if (!response.ok) {
                throw new Error(`Mailpit API error: ${response.statusText}`);
            }

            const data = await response.json();
            const messages: MailpitMessage[] = data.messages || [];

            return await Promise.all(
                messages.map(async (msg) => {
                    const detailResponse = await fetch(`${this.baseUrl}/api/v1/message/${msg.ID}`);
                    if (!detailResponse.ok) {
                        return {
                            id: msg.ID,
                            from: {address: msg.From.Address, name: msg.From.Name},
                            to: msg.To.map(t => ({address: t.Address, name: t.Name})),
                            subject: msg.Subject,
                            text: '',
                            html: '',
                            created_at: msg.Created
                        };
                    }

                    const detail = await detailResponse.json();

                    return {
                        id: msg.ID,
                        from: {address: msg.From.Address, name: msg.From.Name},
                        to: msg.To.map(t => ({address: t.Address, name: t.Name})),
                        subject: msg.Subject,
                        text: detail.Text || '',
                        html: detail.HTML || '',
                        created_at: msg.Created
                    };
                })
            );
        } catch (error) {
            throw new Error(`Failed to fetch emails from Mailpit: ${error}`);
        }
    }

    private async getAllEmailsMailcatcher(): Promise<Email[]> {
        try {
            const response = await fetch(`${this.baseUrl}/messages`);
            if (!response.ok) {
                throw new Error(`Mailcatcher API error: ${response.statusText}`);
            }

            const messages: MailcatcherMessage[] = await response.json();

            return await Promise.all(
                messages.map(async (msg) => {
                    let text = '';
                    let html = '';

                    const textPartResponse = await fetch(
                        `${this.baseUrl}/messages/${msg.id}.plain`
                    ).catch(() => ({ok: false, text: async () => ''}));
                    if (textPartResponse.ok) {
                        text = await textPartResponse.text();
                    }

                    const htmlPartResponse = await fetch(
                        `${this.baseUrl}/messages/${msg.id}.html`
                    ).catch(() => ({ok: false, text: async () => ''}));
                    if (htmlPartResponse.ok) {
                        html = await htmlPartResponse.text();
                    }

                    const normalizedSender = normalizeEmailAddress(msg.sender);

                    return {
                        id: msg.id.toString(),
                        from: {address: normalizedSender, name: normalizedSender},
                        to: msg.recipients.map(recipient => {
                            const normalizedRecipient = normalizeEmailAddress(recipient);
                            return {
                                address: normalizedRecipient,
                                name: normalizedRecipient
                            };
                        }),
                        subject: msg.subject,
                        text,
                        html
                    };
                })
            );
        } catch (error) {
            throw new Error(`Failed to fetch emails from Mailcatcher: ${error}`);
        }
    }
}
