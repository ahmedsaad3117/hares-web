import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomerNote } from "./entities/customer-note.entity";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";
import { UpdateCustomerNoteDto } from "./dto/update-customer-note.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";

@Injectable()
export class CustomerNotesService {
  constructor(
    @InjectRepository(CustomerNote)
    private customerNotesRepository: Repository<CustomerNote>,
  ) {}

  async create(
    createDto: CreateCustomerNoteDto,
    user: any,
  ): Promise<CustomerNote> {
    // Determine branch_id
    let branch_id = user.branchId; // Default to user's branch

    // Allow admin override if branch_id provided
    if (
      createDto.branch_id &&
      (user.role?.roleName === "Institution" ||
        user.role?.roleName === "Super Admin")
    ) {
      branch_id = createDto.branch_id;
    }

    // Create note with determined branch_id and user_id
    const note = this.customerNotesRepository.create({
      ...createDto,
      branch_id,
      user_id: user.userId,
      created_by: user.userId,
      created_at: new Date(),
    });

    return this.customerNotesRepository.save(note);
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResult<CustomerNote>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.customerNotesRepository.findAndCount({
      relations: ["customer", "user", "branch"],
      skip,
      take: limit,
      order: { created_at: "DESC" },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<CustomerNote> {
    const note = await this.customerNotesRepository.findOne({
      where: { id },
      relations: ["customer", "user", "branch"],
    });

    if (!note) {
      throw new NotFoundException(`Customer note with ID ${id} not found`);
    }

    return note;
  }

  async findByCustomer(
    customerId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<CustomerNote>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.customerNotesRepository.findAndCount({
      where: { customer_id: customerId },
      relations: [
        "customer",
        "user",
        "user.institution", // To get institution details for institution users
        "branch",
        "branch.institution", // To get institution details for branch users
      ],
      skip,
      take: limit,
      order: { created_at: "DESC" },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(
    id: number,
    updateDto: UpdateCustomerNoteDto,
    userId: number,
  ): Promise<CustomerNote> {
    const note = await this.findOne(id);

    Object.assign(note, updateDto, {
      last_edited_by: userId,
      edited_at: new Date(),
    });

    return this.customerNotesRepository.save(note);
  }

  async remove(id: number): Promise<void> {
    const note = await this.findOne(id);
    await this.customerNotesRepository.remove(note);
  }
}
