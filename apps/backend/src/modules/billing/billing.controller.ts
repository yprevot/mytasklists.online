import { Body, Controller, Get, Post, Patch, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BillingService } from './billing.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SensitiveThrottle } from '../../common/throttle/throttle-profiles';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminMfaGuard } from '../../common/guards/admin-mfa.guard';
import { UserRole } from '../../database/entities';
import { PromotionDto, CreatePromotionDto, StorePurchaseDto } from './billing.dto';
import { StoreBillingService } from './store-billing.service';
@Controller('billing')
export class BillingController {
 constructor(private readonly billing:BillingService,private readonly stores:StoreBillingService){}
 @Public() @Get('plans') plans(){return this.billing.plans();}
 @Get('me') state(@CurrentUser('id') id:string){return this.billing.state(id);}
 @SensitiveThrottle() @Post('promotion') promotion(@CurrentUser('id') id:string,@Body() dto:PromotionDto){if(!dto.code)throw new BadRequestException('Escribe el código');return this.billing.promotion(dto.code,id);}
 @SensitiveThrottle() @Post('checkout') checkout(@CurrentUser('id') id:string,@Body() dto:PromotionDto){return this.billing.checkout(id,dto.code,dto.expectedTotal);}
 @SensitiveThrottle() @Post('portal') portal(@CurrentUser('id') id:string){return this.billing.portal(id);}
 @Post('native-promotion') nativePromotion(@CurrentUser('id') id:string,@Body() dto:PromotionDto){
   if(!dto.code)throw new BadRequestException('Escribe el código');
   const offers=JSON.parse(process.env.BILLING_NATIVE_PROMOTIONS_JSON||'{}');const offer=offers[dto.code.toUpperCase()];
   if(!offer?.googleOfferId || !Number.isFinite(Date.parse(offer.expiresAt))||Date.parse(offer.expiresAt)<=Date.now())throw new BadRequestException('Este código no está disponible en este canal');
   return {offerId:String(offer.googleOfferId)};
 }
 @Post('store/verify') verify(@CurrentUser('id') id:string,@Body() dto:StorePurchaseDto){return this.stores.verify(id,dto);}
 @Public() @Post('webhook/stripe') webhook(@Req() request:FastifyRequest & {rawBody?:Buffer}){if(!request.rawBody)throw new BadRequestException();return this.billing.webhook(request.rawBody,String(request.headers['stripe-signature']||''));}
 @Public() @Post('webhook/apple') apple(@Body() dto:{signedPayload:string}){return this.stores.appleNotification(dto.signedPayload);}
 @Public() @Post('webhook/google') google(@Req() req:FastifyRequest,@Body() dto:unknown){return this.stores.googleNotification(String(req.headers.authorization||''),dto);}
 @Roles(UserRole.ADMIN) @UseGuards(AdminMfaGuard) @Get('admin/promotions') promotions(){return this.billing.adminPromotions();}
 @Roles(UserRole.ADMIN) @UseGuards(AdminMfaGuard) @Post('admin/promotions') create(@Body() dto:CreatePromotionDto,@CurrentUser('id') id:string){return this.billing.createPromotion(dto,id);}
 @Roles(UserRole.ADMIN) @UseGuards(AdminMfaGuard) @Patch('admin/promotions/:code/disable') disable(@Param('code') code:string,@CurrentUser('id') id:string){return this.billing.disablePromotion(code,id);}
}
