import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ParentsService } from './parents.service';
import { CreateChildDto } from '../childs/dto/create-child';
import { Childs, Parents } from './entities/parents.entity';
import { CreatePrentDto } from './dto/create-Parent.dto';
import { Public } from '../auth/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { Roles } from '../roles/decorators/roles.decorator';
import { JwtAuthGuards } from '../auth/strategy/jwt-auth.guards';
import { RolesGuard } from '../roles/guards/rôles.guard';
import { UpdateChild } from '../childs/dto/update-child';

@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Public()
  @Post('createParent')
  async createParent(@Body() createPrentDto: CreatePrentDto) {
    return await this.parentsService.createParent(createPrentDto);
  }
  @Public()
  @Post('verifiyEmail')
  async verifiyEmail(@Body('email') email: string) {
    return await this.parentsService.verifyEmail(email);
  }
  @UseGuards(JwtAuthGuards, RolesGuard)
  @Roles('Parent')
  @Get('findParent/:id')
  async findOne(@Param('id') id: number): Promise<Parents> {
    return await this.parentsService.findOne(id);
  }

  @Public()
  @UseGuards(JwtAuthGuards, RolesGuard)
  @Roles('Parent')
  @Get('findChild/:id')
  async findChild(@Param('id') id: number): Promise<Childs | undefined> {
    return await this.parentsService.findOneChild(id);
  }

  @UseGuards(JwtAuthGuards, RolesGuard)
  @Roles('Parent')
  @Get('findChildren/:parentId')
  async findAllChildren(
    @Param('parentId') parentId: number,
  ): Promise<Childs[]> {
    return await this.parentsService.findAllChildren(parentId);
  }

  @Public()
  @Post('createChildren')
  @UseInterceptors(FileInterceptor('image'))
  async createChildren(
    @Body() createChildrenDto: CreateChildDto | CreateChildDto[],
    @UploadedFile() image,
  ): Promise<Awaited<Childs | Childs>[]> {
    try {
      const createdChildren = await this.parentsService.createChildOrChildren(
        createChildrenDto,
        image,
      );
      return createdChildren;
    } catch (error) {
      console.error('Erreur lors de la création :', error);
      throw new UnauthorizedException(
        "Erreur lors de la création de l'enfant.",
      );
    }
  }

  @Public()
  @Get('findChildByUsername/:username')
  async findChildByUsername(
    @Param('username') username: string,
  ): Promise<{ found: boolean; child?: Childs }> {
    return await this.parentsService.findChildByUsername(username);
  }
  @UseGuards(JwtAuthGuards, RolesGuard)
  @Roles('Parent')
  @UseInterceptors(FileInterceptor('image'))
  @Patch('updateChild/:id')
  async updateChild(
    @Param('id') id: number,
    @Body() updateChildDto: UpdateChild,
    @UploadedFile() image,
  ) {
    return await this.parentsService.updateChild(id, updateChildDto, image);
  }

  @UseGuards(JwtAuthGuards, RolesGuard)
  @Roles('Parent')
  @Delete('remove/:id')
  remove(@Param('id') id: string) {
    return this.parentsService.remove(+id);
  }

  @Public()
  @Get('parent')
  async getProfile(@Headers('Authorization') token: string) {
    // Recherchez le parent dans la base de données
    if (!token) {
      throw new UnauthorizedException('Token is missing');
    }
    // Extrait le token du header Authorization (format: Bearer token)
    const tokenParts = token.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      throw new UnauthorizedException();
    }

    const accessToken = tokenParts[1];
    const parent = await this.parentsService.getParentFromToken(accessToken);

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    return parent;
  }

  @Public()
  @Get('childrenIdName/:id')
  async getChildrenForParent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; name: string }[]> {
    const names = await this.parentsService.findChildrenNames(id);
    const ids = await this.parentsService.findChildrenId(id);

    return names.map((name, index) => ({ id: ids[index], name }));
  }
}
