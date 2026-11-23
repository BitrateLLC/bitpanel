<?php

namespace App\Console\Commands;

use App\Models\Server;
use Illuminate\Console\Command;

class SnellToV5 extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'snell:to-v5 {--dry-run : 只列出需要降级的节点，不写入数据库}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = '将 Snell v6 节点降级为 v5（Clash 正式版不支持 v6 的 userkey 鉴权）';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $servers = Server::query()
            ->where('type', Server::TYPE_SNELL)
            ->orderBy('id')
            ->get();

        if ($servers->isEmpty()) {
            $this->info('没有找到 Snell 节点');

            return self::SUCCESS;
        }

        $changed = [];

        foreach ($servers as $server) {
            $settings = $server->protocol_settings ?? [];

            if ((int) ($settings['version'] ?? 5) !== 6) {
                continue;
            }

            $settings['version'] = 5;
            if (($settings['obfs_mode'] ?? '') === '') {
                $settings['obfs_mode'] = 'none';
            }

            $changed[] = [$server->id, $server->name];

            if ($dryRun) {
                continue;
            }

            $server->protocol_settings = $settings;
            $server->save();
        }

        if ($changed === []) {
            $this->info('所有 Snell 节点已是 v5，无需处理');

            return self::SUCCESS;
        }

        $this->table(['ID', '名称'], $changed);

        $this->info($dryRun
            ? sprintf('共 %d 个 Snell v6 节点待降级（dry-run，未写入数据库）', count($changed))
            : sprintf('已将 %d 个 Snell 节点降级为 v5，配置会在下次同步时下发给节点', count($changed)));

        return self::SUCCESS;
    }
}
