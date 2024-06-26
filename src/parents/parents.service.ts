import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateChildDto, UpdateChildDto } from '../childs/dto/create-child';
import { Children, Parents } from './entities/parents.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePrentDto } from './dto/create-Parent.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { Roles } from '../roles/entities/roles.entity';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from '../auth/jwtConstants';
import * as dns from 'dns';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/enums/role.enum';
import * as argon2 from 'argon2';

@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(Children)
    private childRepository: Repository<Children>,
    @InjectRepository(Parents)
    private parentsRepository: Repository<Parents>,
    @InjectRepository(Roles)
    private rolesRepository: Repository<Roles>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async createParent(createPrentDto: CreatePrentDto): Promise<{
    parent: {
      password: string;
      tel: number;
      email: string;
      username: string;
    } & Parents;
    access_token: string;
  }> {
    try {
      const existingParent = await this.userRepository.findOne({
        where: { email: createPrentDto.email },
      });
      if (existingParent) {
        throw new BadRequestException(
          'Un parent avec la même adresse e-mail existe déjà',
        );
      }

      const parentRole = await this.rolesRepository.findOne({
        where: { name: Role.Parent },
      });

      // Pas besoin d'appeler createPrentDto.hashPassword(), le mot de passe est déjà haché dans createPrentDto.password
      const hashedPassword = createPrentDto.password;
      console.log('hashedPassword', hashedPassword);
      const createUserDto: {
        password: string;
        roleId: number;
        email: string;
        username: string;
      } = {
        username: createPrentDto.username,
        email: createPrentDto.email,
        password: hashedPassword,
        roleId: parentRole.id,
      };

      const user = this.userRepository.create(createUserDto);
      const savedUser = await this.userRepository.save(user);

      const parent = this.parentsRepository.create({
        tel: createPrentDto.tel,
        email: createPrentDto.email,
        username: createPrentDto.username,
        password: hashedPassword,
        id: savedUser.id,
      });

      const savedParent = await this.parentsRepository.save(parent);

      const payload = {
        email: savedParent.email,
        sub: savedParent.id,
        roleName: parentRole.name,
      };

      const token = await this.jwtService.signAsync(payload, {
        secret: jwtConstants.secret,
        expiresIn: '1h',
      });

      return {
        parent: savedParent,
        access_token: token,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async verifyEmail(email: string): Promise<boolean> {
    // Vérification de l'email avec une expression régulière
    const emailRegex = /^\S+@\S+$/i;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email');
    }

    // Extraction du domaine de l'email
    const domain = email.split('@')[1];

    // Requête DNS pour vérifier le domaine
    return new Promise((resolve, reject) => {
      dns.resolve(domain, 'MX', (err, addresses) => {
        if (err || !addresses || addresses.length === 0) {
          reject(new BadRequestException('Invalid domain'));
        } else {
          resolve(true);
        }
      });
    });
  }
  async createChildOrChildren(
    createChildrenDto: CreateChildDto | CreateChildDto[],
    image: Express.Multer.File,
  ): Promise<Awaited<Children | Children>[]> {
    try {
      console.log('createChildrenDto:', createChildrenDto);
      const childrenToCreate: CreateChildDto[] = Array.isArray(
        createChildrenDto,
      )
        ? createChildrenDto
        : [createChildrenDto];

      const promises = childrenToCreate.map(async (createChildDto) => {
        const parent = await this.parentsRepository.findOne({
          where: { id: createChildDto.id_parent },
        });
        if (!parent) {
          throw new NotFoundException(
            `Parent with ID ${createChildDto.id_parent} not found`,
          );
        }

        const childRole = await this.rolesRepository.findOne({
          where: { name: Role.Child },
        });

        if (!childRole) {
          throw new NotFoundException(`Rôle "Child" non trouvé`);
        }

        const existingChild = await this.childRepository.findOne({
          where: {
            email: `${createChildDto.username}${createChildDto.id_parent}`,
          },
        });

        if (existingChild) {
          throw new BadRequestException(
            `Child with email ${createChildDto.email} already exists`,
          );
        }

        // Créer un utilisateur dans le tableau users avec le rôle "Child"
        const hashedPassword = createChildDto.password;
        const user = this.userRepository.create({
          username: createChildDto.username,
          email: `${createChildDto.username}${createChildDto.id_parent}`,
          password: hashedPassword,
          roleId: childRole.id,
        });
        const savedUser = await this.userRepository.save(user);

        // Créer un enfant dans le tableau children
        const child = new Children();
        child.username = createChildDto.username;
        child.classe = createChildDto.classe;
        child.password = hashedPassword;
        child.parents = parent;
        child.id = savedUser.id;
        child.email = `${createChildDto.username}${createChildDto.id_parent}`;
        if (image) {
          child.image = image.buffer.toString('base64');
        }
        return this.childRepository.save(child);
      });

      return await Promise.all(promises);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async findOne(idOrUsername: number | string): Promise<Parents | undefined> {
    if (typeof idOrUsername === 'number') {
      return await this.parentsRepository.findOne({
        where: { id: idOrUsername },
      });
    } else {
      return await this.parentsRepository.findOne({
        where: { username: idOrUsername },
      });
    }
  }
  async findOneChild(idOrUsername: number): Promise<Children | undefined> {
    const child = this.childRepository.findOne({
      where: { id: idOrUsername },
    });
    return child;
  }

  async findAllChildren(parentId: number): Promise<Children[]> {
    return await this.childRepository.find({
      where: { parents: { id: parentId } },
    });
  }

  async updateChild(
    id: number,
    updateChildDto: UpdateChildDto,
    image: Express.Multer.File,
  ) {
    const child = await this.childRepository.findOne({ where: { id: id } });
    if (!child) {
      throw new NotFoundException("Child doesn't exist");
    }

    // Vérifier si le prénom est unique
    if (updateChildDto.username && updateChildDto.username !== child.username) {
      const existingChild = await this.childRepository.findOne({
        where: { username: updateChildDto.username },
      });
      if (existingChild) {
        throw new BadRequestException(
          'Le prénom existe déjà pour un autre enfant',
        );
      }
    }

    // Vérifier si l'identifiant (email) est unique
    if (updateChildDto.email && updateChildDto.email !== child.email) {
      const existingChild = await this.childRepository.findOne({
        where: { email: updateChildDto.email },
      });
      if (existingChild) {
        throw new BadRequestException(
          "L'identifiant existe déjà pour un autre enfant",
        );
      }
    }

    // Mettre à jour l'image si elle est fournie
    if (image) {
      updateChildDto.image = image.buffer.toString('base64');
    }

    // Mettre à jour les autres champs
    Object.assign(child, updateChildDto);
    if (updateChildDto.password) {
      // Hasher le nouveau mot de passe
      child.password = await bcrypt.hash(updateChildDto.password, 10);
    }

    // Synchroniser les modifications dans le tableau users
    const user = await this.userRepository.findOne({ where: { id: child.id } });
    if (!user) {
      throw new NotFoundException("User doesn't exist for this child");
    }
    Object.assign(user, updateChildDto);
    if (updateChildDto.password) {
      user.password = child.password;
    }
    await this.userRepository.save(user);

    return await this.childRepository.save(child);
  }

  //supprimer un child
  async remove(id: number) {
    const child = await this.childRepository.findOne({ where: { id: id } });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const user = await this.userRepository.findOne({
      where: { id: child.id },
    });
    if (!user) {
      throw new NotFoundException("Associated user doesn't exist");
    }

    await this.childRepository.remove(child);
    return await this.userRepository.remove(user);
  }
  async getParentFromToken(token: string): Promise<Parents | null> {
    try {
      // Décodez le token pour obtenir ses informations sans le vérifier
      const decodedToken = this.jwtService.decode(token);
      console.log('decodedToken:', decodedToken);
      if (!decodedToken || !decodedToken.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      // Recherchez le parent dans la base de données en utilisant l'ID extrait du token
      const parent = await this.parentsRepository.findOne({
        where: { id: decodedToken.sub }, // Utilisation de l'ID extrait du token comme condition de sélection
      });

      // Retournez le parent s'il est trouvé, sinon null
      return parent || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      throw new UnauthorizedException('Invalid Parent');
    }
  }

  async findChildrenNames(parentId: number): Promise<string[]> {
    const parent = await this.parentsRepository.findOne({
      where: { id: parentId },
      relations: ['childs'], // Load the related children
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    // Extract child names from the parent entity
    const childNames = parent.childs.map((child: Children) => child.username);

    return childNames;
  }

  async findChildrenId(parentId: number): Promise<number[]> {
    const parent = await this.parentsRepository.findOne({
      where: { id: parentId },
      relations: ['childs'], // Load the related children
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    // Extract child names from the parent entity
    const childId = parent.childs.map((child: Children) => child.id);

    return childId;
  }

  async findChildByUsername(
    username: string,
  ): Promise<{ found: boolean; child?: Children }> {
    try {
      const child = await this.childRepository.findOne({
        where: { username },
      });

      if (child) {
        return { found: true, child };
      } else {
        return { found: false };
      }
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
