import { RecipleClient, RecipleScript } from 'reciple';
import { Logger } from 'fallout-utility';
import BaseModule from '../BaseModule';
import { AutocompleteInteraction, Awaitable, ButtonInteraction, ContextMenuCommandInteraction, Interaction, InteractionType, ModalSubmitInteraction, SelectMenuInteraction } from 'discord.js';

export enum InteractionEventType {
    ContextMenu,
    SelectMenu,
    Button,
    AutoComplete,
    ModalSubmit
}

export interface InteractionEvent {
    customId: string;
    type: Omit<InteractionEventType, 'AutoComplete'>;
    cached?: boolean;
    handle: (interaction: Interaction<this['cached'] extends true ? 'cached' : this['cached'] extends false ? 'raw' : 'cached'|'raw'>) => Awaitable<void>;
}

export interface AutocompleteInteractionEvent extends Omit<InteractionEvent, 'customId'> {
    commandName: string;
    type: InteractionEventType.AutoComplete;
}

export interface RecipleScriptWithInteractionEvents extends RecipleScript {
    interactionEventHandlers?: (InteractionEvent|AutocompleteInteractionEvent)[];
}

export class InteractionEventsModule extends BaseModule implements RecipleScript {
    public logger!: Logger;

    public onStart(client: RecipleClient): boolean {
        this.logger = client.logger.cloneLogger({ loggerName: 'InteractionEvents' });

        return true;
    }

    public onLoad(client: RecipleClient) {
        client.on('interactionCreate', interaction => {
            const handlers = [...client.modules
                .map(m => m.script)
                .filter((m: RecipleScriptWithInteractionEvents) => m.interactionEventHandlers
                    ?.some(i =>
                        i.type == InteractionEventsModule.getInteractionEventType(interaction)
                        &&
                        (
                            i.cached && interaction.inCachedGuild()
                            ||
                            i.cached === false && interaction.inRawGuild()
                            ||
                            i.cached === undefined
                        )
                    )
                )
                .map((m: RecipleScriptWithInteractionEvents) => m.interactionEventHandlers)
            ];

            for (const handler of handlers) {
                if (!handler) continue;

                handler.forEach(h => h.handle(interaction as Interaction<'cached'|'raw'>));
            }
        });
    }

    public static getInteractionEventType(interaction: Interaction): InteractionEventType|null {
        if (interaction.isAutocomplete()) {
            return InteractionEventType.AutoComplete;
        } else if (interaction.isButton()) {
            return InteractionEventType.Button;
        } else if (interaction.isContextMenuCommand()) {
            return InteractionEventType.ContextMenu;
        } else if (interaction.isModalSubmit()) {
            return InteractionEventType.ModalSubmit;
        } else if (interaction.isSelectMenu()) {
            return InteractionEventType.SelectMenu;
        }

        return null;
    }
}