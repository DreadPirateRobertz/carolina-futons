# Trade/Commercial Program Design

**Bead**: cf-sh6h
**Date**: 2026-03-03

## Overview

Trade/commercial program for Carolina Futons: bulk pricing for volume buyers,
net-30 invoicing for approved accounts, a trade account portal, and tax-exempt
checkout for verified businesses.

## Architecture

### Backend: `src/backend/tradeProgram.web.js`

Single backend service following existing webMethod pattern. Handles:
- Trade account applications and status
- Bulk pricing tier calculations
- Net-30 invoice creation and tracking
- Tax-exempt certificate management

### Frontend: `src/public/tradeHelpers.js`

Helper module for the trade account portal UI section (integrated into Member Page).

### CMS Collections

**TradeAccounts**
- memberId (text, indexed), businessName (text), contactName (text),
  contactEmail (text), phone (text), taxId (text), taxExemptVerified (boolean),
  status (text: pending|approved|rejected|suspended), tier (text: bronze|silver|gold|platinum),
  accountManagerName (text), accountManagerEmail (text), creditLimit (number),
  paymentTerms (number, default 30), approvedAt (dateTime), _createdDate (dateTime)

**TradeInvoices**
- tradeAccountId (text, indexed), orderId (text), invoiceNumber (text),
  subtotal (number), tax (number), total (number), dueDate (dateTime),
  status (text: pending|paid|overdue|void), issuedAt (dateTime), paidAt (dateTime)

## Pricing Tiers

| Tier     | Annual Units | Discount | Extras                    |
|----------|-------------|----------|---------------------------|
| Bronze   | 10-24       | 10%      | Net-30 terms              |
| Silver   | 25-99       | 15%      | Net-30 + priority support |
| Gold     | 100-249     | 20%      | Net-30 + dedicated AM     |
| Platinum | 250+        | 25%      | + free white-glove        |

## API Surface

### Public (Anyone)
- `applyForTradeAccount(application)` - Submit trade application
- `getTradeAccountStatus(email)` - Check application status

### SiteMember
- `getMyTradeAccount()` - Get trade account details
- `getMyTradeInvoices(options)` - Paginated invoice list
- `getMyTradePricing(productPrice, quantity)` - Calculate bulk price
- `uploadTaxExemptCert(certData)` - Submit tax-exempt certificate

### Admin
- `approveTradeAccount(memberId, tier, options)` - Approve application
- `rejectTradeAccount(memberId, reason)` - Reject application
- `createTradeInvoice(params)` - Create invoice for net-30 order
- `updateInvoiceStatus(invoiceId, status)` - Mark paid/overdue/void
- `verifyTaxExempt(memberId, verified)` - Verify tax-exempt status

## Checkout Integration

When a trade member checks out:
1. `getMyTradePricing()` applies tier discount to line items
2. If `taxExemptVerified === true`, tax = $0
3. Net-30 shows as payment option for approved accounts
4. Invoice auto-created post-purchase for net-30 orders

## Trade Portal (Member Page Section)

For approved trade members, the Member Page shows a "Trade Account" section:
- Tier badge and discount info
- Account manager contact
- Invoice history with status and pay links
- Tax-exempt certificate status
- Bulk order quick-form (product + quantity → discounted price)
