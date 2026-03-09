import { OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export declare class AppModule implements OnModuleInit {
    private moduleRef;
    constructor(moduleRef: ModuleRef);
    onModuleInit(): Promise<void>;
}
