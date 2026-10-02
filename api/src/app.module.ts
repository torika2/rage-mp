import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyGuard } from './auth/api-key.guard';
import { UsersModule } from './users/users.module';
import { CharactersModule } from './characters/characters.module';
import { InventoryModule } from './inventory/inventory.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { HousesModule } from './houses/houses.module';
import { ParkingModule } from './parking/parking.module';
import { ItemsModule } from './items/items.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(config.get('DB_PORT', 3306)),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: config.get('DB_SYNCHRONIZE') === 'true',
        charset: 'utf8mb4',
      }),
    }),
    UsersModule,
    CharactersModule,
    InventoryModule,
    VehiclesModule,
    HousesModule,
    ParkingModule,
    ItemsModule,
  ],
  providers: [
    // Protect every endpoint with the shared API key by default.
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}
