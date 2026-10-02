import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginSocialDto } from './dto/login-social.dto';
import { SetTypeDto } from './dto/set-type.dto';
import { SetGenderDto } from './dto/set-gender.dto';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('auth/register')
  register(@Body() dto: RegisterDto) {
    return this.users.register(dto);
  }

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.users.login(dto);
  }

  // In-game login: the server supplies the social-club name from player.socialClub.
  @Post('auth/login-social')
  loginSocial(@Body() dto: LoginSocialDto) {
    return this.users.loginBySocialClub(dto.socialClubName, dto.password);
  }

  // Lets the connect handler decide register vs login for a connecting player.
  @Get('users/social-club/:name')
  async findBySocialClub(@Param('name') name: string) {
    const user = await this.users.findBySocialClub(name);
    if (!user) throw new NotFoundException('No account for this Social Club');
    return user;
  }

  @Get('users/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(id);
  }

  @Patch('users/:id/email-validation')
  setEmailValidation(@Param('id', ParseIntPipe) id: number, @Body('value') value: boolean) {
    return this.users.setValidation(id, 'isEmailValidated', value);
  }

  @Patch('users/:id/phone-validation')
  setPhoneValidation(@Param('id', ParseIntPipe) id: number, @Body('value') value: boolean) {
    return this.users.setValidation(id, 'isPhoneValidated', value);
  }

  @Patch('users/:id/type')
  setType(@Param('id', ParseIntPipe) id: number, @Body() dto: SetTypeDto) {
    return this.users.setType(id, dto.userType);
  }

  @Patch('users/:id/gender')
  setGender(@Param('id', ParseIntPipe) id: number, @Body() dto: SetGenderDto) {
    return this.users.setGender(id, dto.gender);
  }
}
