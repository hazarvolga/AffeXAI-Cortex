import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { CommerceService } from '../services/commerce.service';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';

@Controller('commerce')
@UseGuards(JwtAuthGuard)
export class CommerceController {
    constructor(private readonly commerceService: CommerceService) { }

    @Get('products')
    async getProducts() {
        return this.commerceService.getProducts();
    }

    @Post('products')
    async createProduct(@Body() body: any) {
        return this.commerceService.createProduct(body);
    }

    @Get('subscription')
    async getMySubscription(@Request() req) {
        return this.commerceService.getSubscription(req.user.tenantId);
    }

    @Get('limits')
    async getLimits(@Request() req) {
        console.log(`[CommerceController] checkLimit for tenant: ${req.user?.tenantId}`);
        return this.commerceService.checkLimit(req.user?.tenantId);
    }

    @Get('usage')
    async getUsage(@Request() req) {
        return this.commerceService.getUsageStats(req.user?.tenantId);
    }

    @Post('checkout')
    async createCheckoutSession(@Request() req, @Body() body: { priceId: string }) {
        const session = await this.commerceService.createCheckoutSession(req.user.tenantId, body.priceId, req.user.email);
        return { url: session.url };
    }

    // Admin-only (protected by role in real scenario) or Debug endpoint
    @Post('assign-plan')
    async assignPlan(@Body() body: { tenantId: string; priceId: string }) {
        return this.commerceService.assignPlan(body.tenantId, body.priceId);
    }
}
